from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select

from app.api.deps import get_current_user, get_db
from app.core.config import get_settings
from app.models.enums import PaymentProvider, PurchaseStatus, StoreItemKind
from app.models.memorial import Memorial
from app.models.store import Purchase, StoreItem
from app.models.user import User
from app.schemas.store import CheckoutCreate, CheckoutResponse, PaymentVerifyResponse, PurchasePublic, StoreItemPublic
from app.services.payments import (
    choose_payment_provider,
    create_crypto_checkout,
    create_stripe_checkout_session,
    create_zarinpal_checkout,
    ensure_payment_provider_available,
    payment_provider_is_configured,
    verify_coinbase_webhook_signature,
    verify_stripe_webhook_signature,
    verify_zarinpal_payment,
)
from app.services.store_fulfillment import apply_purchase_fulfillment
from app.services.profile_completion import profile_is_complete

router = APIRouter(prefix="/store", tags=["store"])

DEFAULT_ITEMS = [
    {
        "key": "custom-memorial-id",
        "kind": StoreItemKind.CUSTOM_MEMORIAL_ID,
        "title": {"en": "Random & custom memorial ID", "fa": "آیدی رند و اختصاصی", "ar": "معرف عشوائي ومخصص للذكرى", "zh": "随机与自定义纪念 ID"},
        "description": {
            "en": "Every memorial receives a free random ID. This credit lets you replace it with one meaningful custom public ID.",
            "fa": "هر یادبود یک آیدی رند رایگان دارد. با این اعتبار می‌توانید آن را با یک آیدی عمومی اختصاصی و معنادار جایگزین کنید.",
            "ar": "تحصل كل ذكرى على معرف عشوائي مجاني، وتتيح لك هذه الخدمة استبداله بمعرف عام مخصص.",
            "zh": "每个纪念页都有免费随机 ID；此服务可将其替换为一个自定义公开 ID。",
        },
        "price_usd_cents": 900,
        "price_irr": 5_400_000,
        "item_metadata": {"assignable_to": "account", "custom_ids": 1, "sort_order": 30},
        "is_active": True,
    },
    {
        "key": "halvaa-blue-verification",
        "kind": StoreItemKind.VERIFIED_BADGE,
        "title": {"en": "Halvaa blue verification", "fa": "تیک آبی حلوا", "ar": "شارة تحقق حلفا الزرقاء", "zh": "Halvaa 蓝色认证"},
        "description": {
            "en": "Activate the blue verified tick on one memorial immediately after confirmed payment.",
            "fa": "پس از تأیید پرداخت، تیک آبی معتبر حلوا فوراً برای یک یادبود فعال می‌شود.",
            "ar": "فعّل علامة التحقق الزرقاء لصفحة ذكرى واحدة فور تأكيد الدفع.",
            "zh": "付款确认后，立即为一个纪念页启用蓝色认证标记。",
        },
        "price_usd_cents": 1500,
        "price_irr": 9_000_000,
        "item_metadata": {"assignable_to": "memorial", "badge": "VERIFIED", "sort_order": 10},
        "is_active": True,
    },
    {
        "key": "ceramic-memorial-plaque-set",
        "kind": StoreItemKind.CERAMIC_PLAQUE_SET,
        "title": {"en": "Three-piece ceramic memorial plaques", "fa": "پلاک‌های سه‌گانه سرامیکی مزار", "ar": "طقم لوحات تذكارية خزفية ثلاثي", "zh": "三件套陶瓷墓碑铭牌"},
        "description": {
            "en": "Three durable ceramic plaques for grave-stone installation: portrait, QR code, and memorial page number.",
            "fa": "سه پلاک سرامیکی مقاوم برای نصب روی سنگ مزار: تصویر، QRCode و شماره صفحه آرامگاه.",
            "ar": "ثلاث لوحات خزفية متينة للتركيب على شاهد القبر: صورة ورمز QR ورقم صفحة الذكرى.",
            "zh": "三块耐用陶瓷墓碑铭牌：肖像、二维码和纪念页编号。",
        },
        "price_usd_cents": 4900,
        "price_irr": 29_400_000,
        "item_metadata": {"assignable_to": "memorial", "physical": True, "pieces": 3, "sort_order": 20},
        "is_active": True,
    },
    {
        "key": "featured-placement",
        "kind": StoreItemKind.FEATURED_PLACEMENT,
        "title": {"en": "Featured placement", "fa": "نمایش ویژه", "ar": "عرض مميز", "zh": "精选展示"},
        "description": {
            "en": "Boost a memorial in Explore and landing sliders.",
            "fa": "یادبود را در کاوش و اسلایدر صفحه اصلی برجسته کنید.",
            "ar": "ابرز صفحة الذكرى في الاستكشاف وسلايدر الصفحة الرئيسية.",
            "zh": "在探索页和首页轮播中突出展示纪念页。",
        },
        "price_usd_cents": 1900,
        "price_irr": 11_400_000,
        "item_metadata": {"assignable_to": "memorial", "sort_order": 999},
        "is_active": False,
    },
    {
        "key": "extra-memorial-slot",
        "kind": StoreItemKind.EXTRA_MEMORIAL_SLOT,
        "title": {"en": "Extra memorial slot", "fa": "جایگاه یادبود اضافه", "ar": "مساحة ذكرى إضافية", "zh": "额外纪念页名额"},
        "description": {
            "en": "Create one additional memorial after your free first memorial.",
            "fa": "پس از اولین یادبود رایگان، یک یادبود دیگر ایجاد کنید.",
            "ar": "أنشئ صفحة ذكرى إضافية بعد الصفحة المجانية الأولى.",
            "zh": "在首个免费纪念页之后再创建一个纪念页。",
        },
        "price_usd_cents": 1200,
        "price_irr": 7_200_000,
        "item_metadata": {"assignable_to": "account", "slots": 1, "sort_order": 40},
        "is_active": True,
    },
    {
        "key": "family-legacy-10",
        "kind": StoreItemKind.MEMORIAL_PACKAGE,
        "title": {"en": "Family Legacy 10", "fa": "بسته خانوادگی ۱۰", "ar": "باقة العائلة 10", "zh": "家族传承 10"},
        "description": {
            "en": "Create up to 10 additional memorials and assign 2 unique public IDs.",
            "fa": "تا ۱۰ یادبود اضافه بسازید و ۲ شناسه اختصاصی عمومی اختصاص دهید.",
            "ar": "أنشئ حتى 10 صفحات ذكرى إضافية وخصص معرفين عامين مميزين.",
            "zh": "最多创建 10 个额外纪念页，并分配 2 个专属公开 ID。",
        },
        "price_usd_cents": 7900,
        "price_irr": 47_400_000,
        "item_metadata": {"assignable_to": "account", "memorials": 10, "custom_ids": 2, "sort_order": 50},
        "is_active": True,
    },
]


def _ensure_store_items(session: Session) -> None:
    for item in DEFAULT_ITEMS:
        existing = session.exec(select(StoreItem).where(StoreItem.key == item["key"])).first()
        if existing is None:
            session.add(StoreItem(**item))
            continue
        for field, value in item.items():
            setattr(existing, field, value)
        session.add(existing)
    session.commit()


def _item_to_public(item: StoreItem) -> StoreItemPublic:
    return StoreItemPublic(
        id=item.id,
        key=item.key,
        kind=item.kind.value,
        title=item.title,
        description=item.description,
        price_usd_cents=item.price_usd_cents,
        price_irr=item.price_irr,
        item_metadata=item.item_metadata,
    )


def _purchase_from_external_id(session: Session, purchase_id: object) -> Purchase | None:
    try:
        parsed_id = UUID(str(purchase_id))
    except (TypeError, ValueError):
        return None
    return session.get(Purchase, parsed_id)


@router.get("/items", response_model=list[StoreItemPublic])
def list_store_items(session: Annotated[Session, Depends(get_db)]) -> list[StoreItemPublic]:
    _ensure_store_items(session)
    items = session.exec(select(StoreItem).where(StoreItem.is_active == True)).all()
    items.sort(key=lambda item: int((item.item_metadata or {}).get("sort_order", 100)))
    return [_item_to_public(item) for item in items]


@router.post("/checkout", response_model=CheckoutResponse, status_code=status.HTTP_201_CREATED)
async def create_checkout(
    request: Request,
    payload: CheckoutCreate,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> CheckoutResponse:
    item = session.get(StoreItem, payload.store_item_id)
    if item is None or not item.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store item not found")
    if not profile_is_complete(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="PROFILE_INCOMPLETE")
    assignment_target = (item.item_metadata or {}).get("assignable_to")
    if assignment_target == "memorial":
        if payload.memorial_id is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Choose a memorial for this item")
        memorial = session.get(Memorial, payload.memorial_id)
        if memorial is None or memorial.created_by_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This memorial does not belong to your account")
    elif payload.memorial_id is not None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="This item is assigned to your account, not a memorial")
    country_code = payload.country_code or request.headers.get("cf-ipcountry")
    provider = payload.provider or choose_payment_provider(locale=payload.locale, country_code=country_code)
    ensure_payment_provider_available(provider)
    amount = item.price_irr if provider == PaymentProvider.ZARINPAL else item.price_usd_cents
    currency = "IRR" if provider == PaymentProvider.ZARINPAL else "USD"
    purchase = Purchase(
        user_id=current_user.id,
        store_item_id=item.id,
        memorial_id=payload.memorial_id,
        status=PurchaseStatus.PENDING,
        provider=provider,
        amount=amount,
        currency=currency,
        assignment_payload={"locale": payload.locale},
    )
    session.add(purchase)
    session.commit()
    session.refresh(purchase)
    if provider == PaymentProvider.ZARINPAL:
        checkout = await create_zarinpal_checkout(purchase=purchase, item=item, locale=payload.locale)
    elif provider == PaymentProvider.CRYPTO:
        checkout = await create_crypto_checkout(purchase=purchase, item=item, locale=payload.locale)
    else:
        checkout = await create_stripe_checkout_session(purchase=purchase, item=item, locale=payload.locale)
    if checkout.get("provider_reference"):
        purchase.provider_reference = str(checkout["provider_reference"])
        session.add(purchase)
        session.commit()
    return CheckoutResponse(**checkout)


@router.get("/purchases", response_model=list[PurchasePublic])
def list_purchases(
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[PurchasePublic]:
    return session.exec(select(Purchase).where(Purchase.user_id == current_user.id).order_by(Purchase.created_at.desc())).all()


@router.post("/checkout/{purchase_id}/manual-complete", response_model=PaymentVerifyResponse)
def complete_checkout_for_development(
    purchase_id: UUID,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PaymentVerifyResponse:
    purchase = session.get(Purchase, purchase_id)
    if purchase is None or purchase.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase not found")
    settings = get_settings()
    if (
        settings.is_production
        or not settings.payment_test_mode
        or payment_provider_is_configured(purchase.provider)
        or purchase.provider_reference
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manual checkout completion is unavailable")
    purchase.status = PurchaseStatus.PAID
    purchase.provider_reference = purchase.provider_reference or f"manual:{purchase.id}"
    apply_purchase_fulfillment(session, purchase)
    session.add(purchase)
    session.commit()
    session.refresh(purchase)
    return PaymentVerifyResponse(
        purchase_id=purchase.id,
        status=purchase.status.value,
        provider=purchase.provider.value,
        provider_reference=purchase.provider_reference,
        message="Purchase marked paid for development checkout.",
    )


async def _verify_zarinpal_checkout(
    *, session: Session, purchase_id: UUID, authority: str, status_param: str | None
) -> Purchase:
    purchase = session.get(Purchase, purchase_id)
    if purchase is None or purchase.provider != PaymentProvider.ZARINPAL:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase not found")
    if status_param and status_param.upper() != "OK":
        purchase.status = PurchaseStatus.CANCELED
        session.add(purchase)
        session.commit()
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Payment was canceled")
    reference = await verify_zarinpal_payment(purchase=purchase, authority=authority)
    purchase.status = PurchaseStatus.PAID
    purchase.provider_reference = reference
    apply_purchase_fulfillment(session, purchase)
    session.add(purchase)
    session.commit()
    session.refresh(purchase)
    return purchase


@router.post("/zarinpal/verify", response_model=PaymentVerifyResponse)
async def verify_zarinpal_checkout(
    session: Annotated[Session, Depends(get_db)],
    purchase_id: UUID = Query(...),
    authority: str = Query(..., alias="Authority"),
    status_param: str | None = Query(default=None, alias="Status"),
) -> PaymentVerifyResponse:
    purchase = await _verify_zarinpal_checkout(
        session=session,
        purchase_id=purchase_id,
        authority=authority,
        status_param=status_param,
    )
    return PaymentVerifyResponse(
        purchase_id=purchase.id,
        status=purchase.status.value,
        provider=purchase.provider.value,
        provider_reference=purchase.provider_reference,
        message="Payment verified.",
    )


@router.get("/zarinpal/verify", response_class=RedirectResponse)
async def verify_zarinpal_checkout_redirect(
    session: Annotated[Session, Depends(get_db)],
    purchase_id: UUID = Query(...),
    authority: str = Query(..., alias="Authority"),
    status_param: str | None = Query(default=None, alias="Status"),
) -> RedirectResponse:
    purchase = await _verify_zarinpal_checkout(
        session=session,
        purchase_id=purchase_id,
        authority=authority,
        status_param=status_param,
    )
    locale = str((purchase.assignment_payload or {}).get("locale") or "fa")
    locale = locale if locale in {"en", "fa", "ar", "zh"} else "fa"
    destination = f"{get_settings().payment_frontend_base_url.rstrip('/')}/{locale}/store?payment=success&purchase_id={purchase.id}"
    return RedirectResponse(destination, status_code=status.HTTP_303_SEE_OTHER)


@router.post("/stripe/webhook", response_model=dict)
async def stripe_webhook(request: Request, session: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
    payload = await request.body()
    signature = request.headers.get("stripe-signature")
    if not verify_stripe_webhook_signature(payload, signature):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe signature")
    event = await request.json()
    if event.get("type") == "checkout.session.completed":
        session_data = event.get("data", {}).get("object", {})
        purchase_id = session_data.get("metadata", {}).get("purchase_id") or session_data.get("client_reference_id")
        if purchase_id:
            purchase = _purchase_from_external_id(session, purchase_id)
            if purchase is not None:
                purchase.status = PurchaseStatus.PAID
                purchase.provider_reference = session_data.get("payment_intent") or session_data.get("id")
                apply_purchase_fulfillment(session, purchase)
                session.add(purchase)
                session.commit()
    return {"status": "ok"}


@router.post("/crypto/webhook", response_model=dict)
async def crypto_webhook(request: Request, session: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
    payload = await request.body()
    signature = request.headers.get("x-cc-webhook-signature")
    if not verify_coinbase_webhook_signature(payload, signature):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid crypto webhook signature")
    event = await request.json()
    event_data = event.get("event", {})
    if event_data.get("type") in {"charge:confirmed", "charge:resolved"}:
        charge = event_data.get("data", {})
        purchase_id = charge.get("metadata", {}).get("purchase_id")
        if purchase_id:
            purchase = _purchase_from_external_id(session, purchase_id)
            if purchase is not None and purchase.provider == PaymentProvider.CRYPTO:
                purchase.status = PurchaseStatus.PAID
                purchase.provider_reference = charge.get("code") or charge.get("id")
                apply_purchase_fulfillment(session, purchase)
                session.add(purchase)
                session.commit()
    return {"status": "ok"}
