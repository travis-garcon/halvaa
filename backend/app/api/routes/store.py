from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session, select

from app.api.deps import get_current_user, get_db
from app.models.enums import PaymentProvider, PurchaseStatus, StoreItemKind
from app.models.store import Purchase, StoreItem
from app.models.user import User
from app.schemas.store import CheckoutCreate, CheckoutResponse, PurchasePublic, StoreItemPublic
from app.services.payments import build_checkout_response, choose_payment_provider

router = APIRouter(prefix="/store", tags=["store"])

DEFAULT_ITEMS = [
    {
        "key": "custom-memorial-id",
        "kind": StoreItemKind.CUSTOM_MEMORIAL_ID,
        "title": {"en": "Special memorial ID", "fa": "شناسه اختصاصی یادبود", "ar": "معرف خاص للذكرى", "zh": "专属纪念 ID"},
        "description": {
            "en": "Reserve a meaningful public link for one memorial.",
            "fa": "یک لینک عمومی معنادار برای یک یادبود رزرو کنید.",
            "ar": "احجز رابطا عاما مميزا لصفحة ذكرى واحدة.",
            "zh": "为一个纪念页保留有意义的公开链接。",
        },
        "price_usd_cents": 900,
        "price_irr": 5_400_000,
        "item_metadata": {"assignable_to": "memorial"},
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
        "item_metadata": {"assignable_to": "memorial"},
    },
]


def _ensure_store_items(session: Session) -> None:
    for item in DEFAULT_ITEMS:
        existing = session.exec(select(StoreItem).where(StoreItem.key == item["key"])).first()
        if existing is None:
            session.add(StoreItem(**item))
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


@router.get("/items", response_model=list[StoreItemPublic])
def list_store_items(session: Annotated[Session, Depends(get_db)]) -> list[StoreItemPublic]:
    _ensure_store_items(session)
    items = session.exec(select(StoreItem).where(StoreItem.is_active == True).order_by(StoreItem.created_at.asc())).all()
    return [_item_to_public(item) for item in items]


@router.post("/checkout", response_model=CheckoutResponse, status_code=status.HTTP_201_CREATED)
def create_checkout(
    request: Request,
    payload: CheckoutCreate,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> CheckoutResponse:
    item = session.get(StoreItem, payload.store_item_id)
    if item is None or not item.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store item not found")
    country_code = payload.country_code or request.headers.get("cf-ipcountry")
    provider = choose_payment_provider(locale=payload.locale, country_code=country_code)
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
    )
    session.add(purchase)
    session.commit()
    session.refresh(purchase)
    return CheckoutResponse(**build_checkout_response(provider=provider, purchase_id=str(purchase.id), amount=amount, currency=currency))


@router.get("/purchases", response_model=list[PurchasePublic])
def list_purchases(
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[PurchasePublic]:
    return session.exec(select(Purchase).where(Purchase.user_id == current_user.id).order_by(Purchase.created_at.desc())).all()
