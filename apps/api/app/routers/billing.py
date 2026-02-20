"""Stripe billing: checkout, portal, and webhook handling."""
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/billing", tags=["billing"])


def _init_stripe():
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Billing is not configured on this server.")
    stripe.api_key = settings.STRIPE_SECRET_KEY


@router.get("/status")
async def subscription_status(user: User = Depends(get_current_user)):
    """Return the current user's subscription status."""
    return {
        "subscription_status": user.subscription_status,
        "stripe_enabled": bool(settings.STRIPE_SECRET_KEY),
    }


@router.post("/checkout")
async def create_checkout_session(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Checkout session and return the redirect URL."""
    _init_stripe()

    if not settings.STRIPE_PRICE_ID:
        raise HTTPException(status_code=503, detail="Subscription price is not configured.")

    # Create Stripe customer on first checkout
    if not user.stripe_customer_id:
        customer = stripe.Customer.create(
            email=user.email,
            name=user.full_name,
            metadata={"user_id": str(user.id)},
        )
        user.stripe_customer_id = customer.id
        await db.commit()

    session = stripe.checkout.Session.create(
        customer=user.stripe_customer_id,
        payment_method_types=["card"],
        mode="subscription",
        line_items=[{"price": settings.STRIPE_PRICE_ID, "quantity": 1}],
        success_url=f"{settings.FRONTEND_URL}/billing?success=1",
        cancel_url=f"{settings.FRONTEND_URL}/billing?canceled=1",
        client_reference_id=str(user.id),
    )
    return {"url": session.url}


@router.post("/portal")
async def create_billing_portal(user: User = Depends(get_current_user)):
    """Open the Stripe customer portal so the user can manage their subscription."""
    _init_stripe()

    if not user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No billing account found. Please subscribe first.")

    portal = stripe.billing_portal.Session.create(
        customer=user.stripe_customer_id,
        return_url=f"{settings.FRONTEND_URL}/billing",
    )
    return {"url": portal.url}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Stripe webhook events (subscription lifecycle)."""
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Billing not configured.")

    stripe.api_key = settings.STRIPE_SECRET_KEY
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload.")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid webhook signature.")

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        user_id_str = data.get("client_reference_id")
        if not user_id_str:
            return {"received": True}
        try:
            user_id = int(user_id_str)
        except (ValueError, TypeError):
            return {"received": True}

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user:
            user.subscription_status = "active"
            user.stripe_customer_id = data.get("customer")
            user.stripe_subscription_id = data.get("subscription")
            await db.commit()

    elif event_type in ("customer.subscription.updated", "customer.subscription.deleted"):
        stripe_status = data.get("status")          # active | past_due | canceled | unpaid | paused
        customer_id = data.get("customer")
        subscription_id = data.get("id")

        result = await db.execute(select(User).where(User.stripe_customer_id == customer_id))
        user = result.scalar_one_or_none()
        if user:
            user.subscription_status = stripe_status if stripe_status in (
                "active", "trialing", "past_due", "canceled", "unpaid", "paused"
            ) else "inactive"
            user.stripe_subscription_id = subscription_id
            await db.commit()

    return {"received": True}
