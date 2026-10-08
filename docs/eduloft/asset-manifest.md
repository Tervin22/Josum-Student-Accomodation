# Eduloft Asset Manifest

Public Eduloft assets copied into `apps/web/public/eduloft` for local, production-safe rendering without hotlinking.

| Local asset | Source | Usage |
| --- | --- | --- |
| `eduloft-logo.png` | Eduloft public logo upload | Header, login, email brand reference |
| `eduloft-featured.webp` | Eduloft public featured image | Login hero background |
| `eduloft-nook.webp` | Eduloft Nook room page image | Public room card |
| `eduloft-studio.webp` | Eduloft Studio room page image | Public room card |
| `eduloft-quarter.webp` | Eduloft Quarter room page image | Public room card |
| `eduloft-loft.webp` | Eduloft Loft room page image | Public room card |
| `eduloft-common-areas.jpg` | Eduloft public brochure imagery | Residences page hero |
| `eduloft-reception.jpg` | Eduloft public brochure imagery | Reserved for future gallery use |
| `eduloft-lounge.jpg` | Eduloft public brochure imagery | Reserved for future gallery use |
| `eduloft-study-lounge.jpg` | Eduloft public brochure imagery | Reserved for future gallery use |
| `eduloft-room-suite.jpg` | Eduloft public brochure imagery | Reserved for future gallery use |
| `eduloft-kitchen-study.jpg` | Eduloft public brochure imagery | Reserved for future gallery use |
| `eduloft-desk-tv.jpg` | Eduloft public brochure imagery | Reserved for future gallery use |
| `eduloft-brochure-page-1.jpg` | Eduloft public brochure | Reference snapshot |
| `eduloft-brochure-page-2.jpg` | Eduloft public brochure | Reference snapshot |

## Asset Notes

- The application references local `/eduloft/...` paths by default.
- `NEXT_PUBLIC_BRAND_LOGO_URL` and `NEXT_PUBLIC_AUTH_HERO_IMAGE_URL` can override the default local assets.
- Public brochure crops are included only where they help the professional Eduloft presentation; operational facts still come from the source manifest and public pages.
