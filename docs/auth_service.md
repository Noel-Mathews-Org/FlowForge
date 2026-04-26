# Auth Service

The Auth Service is FlowForge's identity provider. It manages user lifecycle, JWT-based authentication, and organizational access through invitations.

## Technology
- **Framework:** FastAPI (async)
- **ORM:** SQLAlchemy 2.0 with asyncpg
- **Database:** `auth_db` on PostgreSQL 16
- **Password Hashing:** bcrypt
- **Token Format:** JWT (HS256) signed with `JWT_SECRET`

## API Endpoints

| Method | Path | Auth | Description |
|:---|:---|:---|:---|
| POST | `/auth/login` | Public | Authenticate and receive a JWT |
| POST | `/auth/register` | Public | Register using an invite token |
| POST | `/auth/invite` | Manager/Admin | Generate an invite token and send email |
| POST | `/auth/invite-to-project` | Manager/Admin | Create a user account and add to a project |
| GET | `/auth/me` | Authenticated | Get the current user's profile |
| PUT | `/auth/me` | Authenticated | Update name or change password |
| GET | `/auth/lookup?email=` | Manager/Admin | Look up a user by email |

## Database Schema (`auth_db`)

### `users`
| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | PK, default `gen_random_uuid()` | Unique identifier |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL, INDEX | Login email |
| `hashed_password` | VARCHAR(255) | NOT NULL | bcrypt hash |
| `full_name` | VARCHAR(255) | NOT NULL | Display name |
| `role` | ENUM (`admin`, `manager`, `member`) | NOT NULL | System-wide role |
| `org` | VARCHAR(255) | NOT NULL, default `flowforge` | Organization |
| `is_active` | BOOLEAN | NOT NULL, default `true` | Account status |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` | Registration time |

### `refresh_tokens`
| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | PK | Token identifier |
| `user_id` | UUID | FK → `users.id`, INDEX | Owner |
| `token` | VARCHAR(255) | UNIQUE, INDEX | Token string |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Expiration |
| `revoked` | BOOLEAN | default `false` | Invalidation flag |

### `invite_tokens`
| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | PK | Token identifier |
| `token` | VARCHAR(255) | UNIQUE, INDEX | Secret URL token |
| `email` | VARCHAR(255) | NOT NULL | Target email |
| `role` | ENUM (`manager`, `member`) | NOT NULL | Role on registration |
| `created_by` | UUID | FK → `users.id` | Inviter |
| `used` | BOOLEAN | default `false` | Whether token was consumed |
| `expires_at` | TIMESTAMPTZ | NOT NULL | 72-hour expiry |

## Communication
- **Incoming:** REST calls from the API Gateway.
- **Outgoing:** SMTP emails (invitations, project invites with credentials).
- **Redis:** Publishes `email.invite` events.
- **JWT Propagation:** Other services validate the JWT locally using the shared `JWT_SECRET`. The Gateway injects `X-User-ID`, `X-User-Role`, `X-User-Email`, and `X-User-Org` headers into upstream requests.
