# Coastal Customs V5

This version restores the Coastal Customs blue/ocean identity and removes emoji UI.

## Run

```bash
cd ~/Downloads/coastal-customs-v5
npm install
STAFF_PASSWORD="coastal123" JWT_SECRET="change-this-secret" npm start
```

Open:

```text
http://localhost:3000
```

Staff panel:

```text
http://localhost:3000/staff
```

Password:

```text
coastal123
```

## Included

- Coastal blue/navy theme
- Real Coastal Customs logo from generated assets
- No emoji UI icons; uses clean inline SVG icons
- Professional customer dashboard
- Customer balance/wallet
- Balance top-up mock system
- Transaction history
- Orders page
- Downloads page
- Tickets page
- Hidden staff panel at /staff
- Admin overview
- Product manager
- Product image upload from your Mac
- Manual order creation
- Customer balance adjustment
- Ticket replies
- Review moderation

Payments are still mock/local until Stripe/SellAuth integration is added.
