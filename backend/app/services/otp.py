import hashlib
import random
import secrets
import smtplib
import socket
import struct
from datetime import timedelta
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

import httpx

from app.core.config import get_settings
from app.models.base import utc_now


def generate_otp_code() -> str:
    return f"{secrets.randbelow(10_000):04d}"


def hash_otp_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def verify_otp_code(code: str, code_hash: str) -> bool:
    return secrets.compare_digest(hash_otp_code(code), code_hash)


def otp_expiry():
    return utc_now() + timedelta(minutes=get_settings().otp_expire_minutes)


class OtpDeliveryError(RuntimeError):
    pass


def _build_email_message(*, email: str, code: str) -> EmailMessage:
    settings = get_settings()
    email_message = EmailMessage()
    email_message["Subject"] = "Your Halvaa verification code"
    email_message["From"] = formataddr((settings.smtp_from_name, settings.smtp_from_email))
    email_message["To"] = email
    email_message["Date"] = utc_now().strftime("%a, %d %b %Y %H:%M:%S +0000")
    email_message["Message-ID"] = make_msgid(domain=settings.smtp_helo_domain)
    email_message["Auto-Submitted"] = "auto-generated"
    email_message["X-Auto-Response-Suppress"] = "All"
    email_message.set_content(
        f"Your Halvaa verification code is {code}.\n\nThis code expires in {settings.otp_expire_minutes} minutes.",
    )
    return email_message


def _read_dns_name(packet: bytes, offset: int) -> tuple[str, int]:
    labels: list[str] = []
    jumped = False
    original_offset = offset
    seen_offsets: set[int] = set()

    while True:
        if offset >= len(packet):
            raise OtpDeliveryError("Invalid DNS response")
        length = packet[offset]
        if length == 0:
            offset += 1
            break
        if length & 0xC0 == 0xC0:
            if offset + 1 >= len(packet):
                raise OtpDeliveryError("Invalid DNS pointer")
            pointer = ((length & 0x3F) << 8) | packet[offset + 1]
            if pointer in seen_offsets:
                raise OtpDeliveryError("DNS pointer loop")
            seen_offsets.add(pointer)
            if not jumped:
                original_offset = offset + 2
            offset = pointer
            jumped = True
            continue
        offset += 1
        labels.append(packet[offset : offset + length].decode("ascii", errors="ignore"))
        offset += length

    return ".".join(labels), original_offset if jumped else offset


def _encode_dns_name(name: str) -> bytes:
    return b"".join(bytes([len(part)]) + part.encode("ascii") for part in name.rstrip(".").split(".")) + b"\x00"


def _resolve_mx_records(domain: str) -> list[str]:
    query_id = random.randrange(0, 65536)
    header = struct.pack("!HHHHHH", query_id, 0x0100, 1, 0, 0, 0)
    question = _encode_dns_name(domain) + struct.pack("!HH", 15, 1)
    packet = header + question
    nameservers = ["1.1.1.1", "8.8.8.8"]

    for nameserver in nameservers:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                sock.settimeout(5)
                sock.sendto(packet, (nameserver, 53))
                response, _ = sock.recvfrom(4096)
        except OSError:
            continue

        if len(response) < 12:
            continue
        response_id, _, qdcount, ancount, _, _ = struct.unpack("!HHHHHH", response[:12])
        if response_id != query_id:
            continue

        offset = 12
        for _ in range(qdcount):
            _, offset = _read_dns_name(response, offset)
            offset += 4

        records: list[tuple[int, str]] = []
        for _ in range(ancount):
            _, offset = _read_dns_name(response, offset)
            if offset + 10 > len(response):
                raise OtpDeliveryError("Invalid DNS answer")
            record_type, _, _, rdlength = struct.unpack("!HHIH", response[offset : offset + 10])
            offset += 10
            rdata_offset = offset
            offset += rdlength
            if record_type != 15 or rdlength < 3:
                continue
            preference = struct.unpack("!H", response[rdata_offset : rdata_offset + 2])[0]
            exchange, _ = _read_dns_name(response, rdata_offset + 2)
            if exchange and exchange != ".":
                records.append((preference, exchange.rstrip(".")))
        if records:
            return [record for _, record in sorted(records)]

    raise OtpDeliveryError("Could not resolve recipient mail server")


def _send_direct_email(email: str, message: EmailMessage) -> None:
    settings = get_settings()
    domain = email.rsplit("@", 1)[-1]
    mx_records = _resolve_mx_records(domain)
    errors: list[str] = []

    for mx_record in mx_records:
        try:
            with smtplib.SMTP(mx_record, 25, local_hostname=settings.smtp_helo_domain, timeout=15) as smtp:
                smtp.send_message(message, from_addr=settings.smtp_from_email, to_addrs=[email])
            return
        except (OSError, smtplib.SMTPException) as exc:
            errors.append(f"{mx_record}: {exc}")

    raise OtpDeliveryError("Direct email delivery failed: " + "; ".join(errors))


async def send_otp_message(*, email: str, code: str, phone_number: str | None = None) -> str:
    settings = get_settings()
    provider = settings.sms_provider.lower()
    message = f"Halvaa verification code: {code}"

    if phone_number and provider == "kavenegar" and settings.sms_api_key:
        url = f"https://api.kavenegar.com/v1/{settings.sms_api_key}/sms/send.json"
        payload = {
            "receptor": phone_number,
            "message": message,
        }
        if settings.sms_sender:
            payload["sender"] = settings.sms_sender
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(url, data=payload)
        return "kavenegar"

    if phone_number and provider == "kavenegar" and not settings.sms_api_key and settings.environment != "production":
        # Keep local/staging sign-in usable without accidentally exposing this
        # fallback in production, where a real SMS provider is required.
        print(f"[halvaa otp] {email} {phone_number}: {code}")
        return "console"

    if phone_number and provider == "console":
        print(f"[halvaa otp] {email} {phone_number}: {code}")
        return "console"

    smtp_host = settings.smtp_host
    if not smtp_host and not settings.smtp_direct_delivery and settings.environment in {"staging", "production"}:
        smtp_host = "smtp"

    if not phone_number and smtp_host:
        email_message = _build_email_message(email=email, code=code)

        def send_email() -> None:
            try:
                with smtplib.SMTP(smtp_host, settings.smtp_port, local_hostname=settings.smtp_helo_domain, timeout=10) as smtp:
                    if settings.smtp_use_tls:
                        smtp.starttls()
                    if settings.smtp_username and settings.smtp_password:
                        smtp.login(settings.smtp_username, settings.smtp_password)
                    smtp.send_message(email_message)
            except (OSError, smtplib.SMTPException) as exc:
                raise OtpDeliveryError(f"SMTP delivery failed: {exc}") from exc

        import anyio

        await anyio.to_thread.run_sync(send_email)
        return "smtp"

    if not phone_number and settings.environment != "production":
        print(f"[halvaa otp] {email}: {code}")
        return "console"

    if not phone_number and settings.smtp_direct_delivery:
        email_message = _build_email_message(email=email, code=code)

        import anyio

        await anyio.to_thread.run_sync(_send_direct_email, email, email_message)
        return "direct-smtp"

    raise OtpDeliveryError("No OTP delivery provider is configured")
