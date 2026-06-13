### Diagram
```mermaid

flowchart TD

A[User Opens App] --> B{User Type?}

B -->|Guest| C[Browse Movies]
B -->|Customer| D[Authenticated Customer Dashboard]
B -->|Admin| E[Admin Panel]
B -->|Cashier| F[Cashier Panel]

%% ---------------- GUEST FLOW ----------------
C --> G[View Movie List]
G --> H[View Movie Details]

H --> I[Select Showtime]

I --> J[View Seat Map]
J --> K[Display Seats\nAVAILABLE / BOOKED / LOCKED]

K --> L[Try to Add Seats / Book]

L --> M{Authenticated?}

M -- No --> N[Redirect to Login / Sign Up]
N --> O[Authenticate User]
O --> D

M -- Yes --> P[Create Seat Hold\nTEMP LOCK 5 MIN]

%% ---------------- CUSTOMER FLOW ----------------
D --> Q[Continue Booking Flow]

Q --> P

P --> R[Add to Cart / Booking Draft]

R --> S[Checkout]
S --> T[Payment Gateway]

T --> U{Payment Success?}

U -- YES --> V[Confirm Booking]
V --> W[Mark Seats BOOKED]
W --> X[Generate Ticket + QR]
X --> Y[Send Confirmation]

U -- NO --> Z[Cancel Booking]
Z --> AA[Release Seat Hold]

%% Expiry handling
P --> AB{Hold Expired?}
AB -- YES --> AA

%% ---------------- ADMIN FLOW ----------------
E --> AC[Manage Movies / Showtimes / Cinemas]
E --> AD[View Reports & Bookings]

%% ---------------- CASHIER FLOW ----------------
F --> AE[Verify Booking]
AE --> AF[Process Payment]
AF --> V