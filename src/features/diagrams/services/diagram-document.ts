export type DiagramViewMode = "source" | "split" | "preview";

export const MAX_MERMAID_SOURCE_LENGTH = 50_000;

export interface DiagramTemplate {
  id: string;
  label: string;
  category: string;
  description: string;
  content: string;
}

function template(
  id: string,
  label: string,
  category: string,
  description: string,
  content: string,
): DiagramTemplate {
  return { id, label, category, description, content };
}

export const DIAGRAM_TEMPLATES: readonly DiagramTemplate[] = [
  template(
    "flowchart",
    "Flowchart",
    "General",
    "A connected process with a decision and feedback path.",
    `flowchart TD
  Start([Start]) --> Process[Process]
  Process --> Decision{Done?}
  Decision -- Yes --> Finish([Finish])
  Decision -- No --> Process`,
  ),
  template(
    "sequence",
    "Sequence",
    "General",
    "Request and response messages between a user and application.",
    `sequenceDiagram
  actor User
  participant App
  User->>App: Request
  App-->>User: Response`,
  ),
  template(
    "class",
    "Class",
    "General",
    "A simple object model and its relationship.",
    `classDiagram
  class User {
    +String name
    +signIn()
  }
  class Session {
    +Date expiresAt
  }
  User --> Session`,
  ),
  template(
    "entity-relationship",
    "Entity relationship",
    "General",
    "A customer, order, and line-item relationship model.",
    `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  PRODUCT ||--o{ LINE_ITEM : includes`,
  ),
  template(
    "state",
    "State",
    "General",
    "A lifecycle with success and error transitions.",
    `stateDiagram-v2
  [*] --> Idle
  Idle --> Running: start
  Running --> Complete: finish
  Running --> Failed: error
  Complete --> [*]
  Failed --> [*]`,
  ),
  template(
    "user-journey",
    "User journey",
    "General",
    "Customer steps and satisfaction through a purchase.",
    `journey
  title Online purchase
  section Discover
    Browse catalog: 5: Customer
    Compare products: 4: Customer
  section Purchase
    Add to cart: 4: Customer
    Complete checkout: 3: Customer`,
  ),
  template(
    "timeline",
    "Timeline",
    "General",
    "Milestones on a product delivery timeline.",
    `timeline
  title Product delivery
  section Discovery
    Week 1 : Requirements
    Week 2 : Architecture
  section Delivery
    Week 3 : Implementation
    Week 4 : Launch`,
  ),
  template(
    "git-workflow",
    "Git branching workflow",
    "General",
    "Feature branch work merged back into the main branch.",
    `gitGraph
  commit id: "Initial"
  branch feature
  checkout feature
  commit id: "Implement"
  commit id: "Test"
  checkout main
  merge feature id: "Release"`,
  ),
  template(
    "gantt",
    "Gantt project plan",
    "General",
    "A short plan with dependent design, implementation, and test tasks.",
    `gantt
  title Delivery plan
  dateFormat YYYY-MM-DD
  section Build
    Design       :a1, 2026-01-05, 5d
    Implementation :after a1, 8d
  section Verify
    Testing      :after a1, 4d
    Release      :after Implementation, 1d`,
  ),
  template(
    "system-architecture",
    "High-level system architecture",
    "Software architecture",
    "A browser request flowing through an API to data services.",
    `flowchart LR
  User[Customer] --> Web[Web application]
  Web --> API[Application API]
  API --> DB[(Primary database)]
  API --> Cache[(Cache)]
  API --> Queue[Message queue]
  Queue --> Worker[Background worker]
  Worker --> DB`,
  ),
  template(
    "frontend-backend-database",
    "Frontend, backend, and database",
    "Software architecture",
    "A frontend calling backend services backed by a database.",
    `flowchart LR
  Browser[Browser] --> Frontend[Frontend application]
  Frontend --> API[Backend API]
  API --> Auth[Authentication service]
  API --> Database[(Application database)]
  API --> Storage[(Object storage)]`,
  ),
  template(
    "monolith",
    "Monolith architecture",
    "Software architecture",
    "A modular monolith with shared application data.",
    `flowchart TB
  Client[Web and mobile clients] --> App[Monolithic application]
  subgraph App[Application modules]
    API[HTTP API] --> Orders[Order module]
    API --> Accounts[Account module]
    Orders --> Billing[Billing module]
  end
  Orders --> DB[(Shared database)]
  Accounts --> DB
  Billing --> DB`,
  ),
  template(
    "microservices",
    "Microservices architecture",
    "Software architecture",
    "Independent services with owned data stores and event integration.",
    `flowchart LR
  Client[Client] --> Gateway[API gateway]
  Gateway --> Catalog[Catalog service]
  Gateway --> Orders[Order service]
  Gateway --> Accounts[Account service]
  Catalog --> CatalogDB[(Catalog data)]
  Orders --> OrdersDB[(Order data)]
  Accounts --> AccountDB[(Account data)]
  Orders --> Events[Event broker]
  Events --> Catalog`,
  ),
  template(
    "api-gateway",
    "API gateway",
    "Software architecture",
    "Gateway routing, authentication, and downstream service calls.",
    `flowchart LR
  Client[Web client] --> Gateway[API gateway]
  Gateway --> Auth[Identity provider]
  Gateway -->|catalog route| Catalog[Catalog service]
  Gateway -->|orders route| Orders[Order service]
  Catalog --> CatalogDB[(Catalog database)]
  Orders --> OrdersDB[(Order database)]`,
  ),
  template(
    "event-driven",
    "Event-driven architecture",
    "Software architecture",
    "A producer publishes events consumed by independent services.",
    `flowchart LR
  Client[Client] --> Orders[Order service]
  Orders --> OrderDB[(Order database)]
  Orders -->|OrderCreated| Broker[Event broker]
  Broker --> Inventory[Inventory consumer]
  Broker --> Notifications[Notification consumer]
  Inventory --> StockDB[(Stock database)]`,
  ),
  template(
    "message-queue",
    "Message queue",
    "Software architecture",
    "A producer and workers exchanging queued jobs with acknowledgments.",
    `sequenceDiagram
  participant API as Producer API
  participant Queue as Job queue
  participant Worker as Worker
  API->>Queue: Publish job
  Queue-->>API: Job accepted
  Worker->>Queue: Fetch job
  Queue-->>Worker: Job payload
  Worker->>Worker: Process job
  Worker-->>Queue: Acknowledge`,
  ),
  template(
    "authentication",
    "Authentication and authorization",
    "Software architecture",
    "A browser sign-in flow with identity verification and protected API access.",
    `sequenceDiagram
  actor User
  participant App as Web application
  participant IdP as Identity provider
  participant API as Protected API
  User->>App: Sign in
  App->>IdP: Request authorization
  IdP-->>App: Return access token
  App->>API: Call with token
  API->>IdP: Validate token and scopes
  IdP-->>API: Claims
  API-->>App: Authorized response`,
  ),
  template(
    "realtime",
    "Real-time communication",
    "Software architecture",
    "Clients connect through a real-time gateway backed by a shared event channel.",
    `flowchart LR
  ClientA[Client A] <-->|WebSocket| Gateway[Real-time gateway]
  ClientB[Client B] <-->|WebSocket| Gateway
  Gateway --> Broker[Pub/sub broker]
  API[Application API] --> Broker
  Broker --> Gateway
  Gateway --> Presence[(Presence store)]`,
  ),
  template(
    "distributed-cache",
    "Distributed caching",
    "Software architecture",
    "Cache-aside reads and database-backed cache misses.",
    `sequenceDiagram
  participant Client
  participant API
  participant Cache
  participant DB as Database
  Client->>API: Read resource
  API->>Cache: Lookup key
  alt Cache hit
    Cache-->>API: Cached value
  else Cache miss
    API->>DB: Read resource
    DB-->>API: Resource
    API->>Cache: Store value with TTL
  end
  API-->>Client: Resource`,
  ),
  template(
    "data-pipeline",
    "Data pipeline",
    "Software architecture",
    "Ingestion, validation, transformation, and analytical storage.",
    `flowchart LR
  Sources[Source systems] --> Ingest[Ingestion]
  Ingest --> Raw[(Raw data lake)]
  Raw --> Validate[Validate and normalize]
  Validate --> Transform[Transform]
  Transform --> Warehouse[(Analytics warehouse)]
  Warehouse --> Reports[Reports and dashboards]`,
  ),
  template(
    "service-dependencies",
    "Service dependency graph",
    "Software architecture",
    "A small connected graph showing service dependencies.",
    `flowchart TB
  Web[Web application] --> Gateway[API gateway]
  Gateway --> Identity[Identity service]
  Gateway --> Orders[Order service]
  Orders --> Inventory[Inventory service]
  Orders --> Payments[Payment provider]
  Orders --> OrderDB[(Order database)]`,
  ),
  template(
    "deployment",
    "Deployment architecture",
    "Software architecture",
    "A generic deployment view from edge routing to application and data tiers.",
    `flowchart TB
  User[User] --> DNS[DNS]
  DNS --> Edge[Edge proxy]
  Edge --> App1[Application instance A]
  Edge --> App2[Application instance B]
  App1 --> DB[(Managed database)]
  App2 --> DB
  App1 --> Logs[Central logs]
  App2 --> Logs`,
  ),
  template(
    "c4-style-context",
    "C4-style context view",
    "Software architecture",
    "A generic Mermaid context view; uses standard flowchart shapes, not official C4 symbols.",
    `flowchart LR
  Person[Person: Customer] --> System[System: Storefront]
  System --> Payment[External system: Payment provider]
  System --> Identity[External system: Identity provider]
  System --> Email[External system: Email service]`,
  ),
  template(
    "aws-generic",
    "AWS reference architecture (generic)",
    "Cloud and infrastructure",
    "A provider-neutral cloud layout; nodes are generic Mermaid shapes, not AWS icons.",
    `flowchart LR
  User[Users] --> CDN[Content delivery]
  CDN --> Web[Web application]
  Web --> API[Application API]
  API --> DB[(Managed database)]
  API --> Queue[Managed queue]
  Queue --> Worker[Background worker]`,
  ),
  template(
    "azure-generic",
    "Azure reference architecture (generic)",
    "Cloud and infrastructure",
    "A provider-neutral cloud layout; nodes are generic Mermaid shapes, not Azure icons.",
    `flowchart LR
  Client[Clients] --> Edge[Edge routing]
  Edge --> App[Application service]
  App --> Identity[Identity service]
  App --> DB[(Managed database)]
  App --> Blob[(Object storage)]`,
  ),
  template(
    "gcp-generic",
    "Google Cloud reference architecture (generic)",
    "Cloud and infrastructure",
    "A provider-neutral cloud layout; nodes are generic Mermaid shapes, not Google Cloud icons.",
    `flowchart LR
  Client[Clients] --> Gateway[API gateway]
  Gateway --> Compute[Application compute]
  Compute --> SQL[(Managed SQL)]
  Compute --> Events[Event service]
  Events --> Worker[Processing worker]
  Worker --> Warehouse[(Analytics warehouse)]`,
  ),
  template(
    "compose-topology",
    "Docker Compose service topology",
    "Cloud and infrastructure",
    "A generic local service, network, volume, and dependency topology.",
    `flowchart LR
  Browser[Browser] --> Web[web service]
  Web --> API[api service]
  API --> DB[(db service)]
  API --> Cache[(cache service)]
  DB --- Volume[(database volume)]
  subgraph app-network[Application network]
    Web
    API
    DB
    Cache
  end`,
  ),
  template(
    "kubernetes",
    "Kubernetes deployment",
    "Cloud and infrastructure",
    "A generic deployment, service, and persistent data path; not official Kubernetes icons.",
    `flowchart TB
  User[User] --> Ingress[Ingress]
  Ingress --> Service[Cluster service]
  Service --> PodA[Application pod A]
  Service --> PodB[Application pod B]
  PodA --> PVC[(Persistent volume claim)]
  PodB --> PVC`,
  ),
  template(
    "load-balancer",
    "Load balancer and reverse proxy",
    "Cloud and infrastructure",
    "Traffic flows through a reverse proxy to healthy application instances.",
    `flowchart LR
  Clients[Clients] --> Proxy[Reverse proxy]
  Proxy --> LB[Load balancer]
  LB --> AppA[Application A]
  LB --> AppB[Application B]
  AppA --> DB[(Shared database)]
  AppB --> DB`,
  ),
  template(
    "multi-region",
    "Multi-region architecture",
    "Cloud and infrastructure",
    "Global routing to two regions with replicated data.",
    `flowchart TB
  User[Global users] --> DNS[Global traffic manager]
  DNS --> RegionA
  DNS --> RegionB
  subgraph RegionA[Region A]
    AppA[Application]
    DBA[(Primary database)]
  end
  subgraph RegionB[Region B]
    AppB[Application]
    DBB[(Replica database)]
  end
  AppA --> DBA
  AppB --> DBB
  DBA <-->|Replication| DBB`,
  ),
  template(
    "cicd",
    "CI/CD pipeline",
    "Cloud and infrastructure",
    "A change moves through build, test, approval, and deployment stages.",
    `flowchart LR
  Commit[Code change] --> Build[Build]
  Build --> UnitTests[Unit tests]
  UnitTests --> Scan[Security and quality checks]
  Scan --> Approval{Approved?}
  Approval -- Yes --> Deploy[Deploy]
  Approval -- No --> Fix[Return for fixes]
  Fix --> Commit
  Deploy --> Monitor[Verify deployment]`,
  ),
  template(
    "observability",
    "Monitoring and observability",
    "Cloud and infrastructure",
    "Services emit telemetry to monitoring, logging, and tracing systems.",
    `flowchart LR
  Service[Application services] --> Metrics[Metrics]
  Service --> Logs[Logs]
  Service --> Traces[Traces]
  Metrics --> Monitor[Monitoring platform]
  Logs --> Monitor
  Traces --> Monitor
  Monitor --> Alert[Alerting]
  Monitor --> Dashboard[Dashboards]`,
  ),
  template(
    "network-topology",
    "Network topology",
    "Cloud and infrastructure",
    "Public, application, and data network segments with controlled paths.",
    `flowchart LR
  Internet[Internet] --> Edge[Public edge]
  Edge --> AppNetwork
  subgraph AppNetwork[Application network]
    Gateway[Gateway] --> App[Application]
  end
  App --> DataNetwork
  subgraph DataNetwork[Private data network]
    DB[(Database)]
  end`,
  ),
  template(
    "trust-boundaries",
    "Security boundaries and trust zones",
    "Cloud and infrastructure",
    "A user-to-service path crossing explicit trust boundaries.",
    `flowchart LR
  subgraph External[Untrusted zone]
    User[User device]
  end
  subgraph Edge[Edge trust boundary]
    WAF[Request filtering]
    Gateway[API gateway]
  end
  subgraph Internal[Private service zone]
    API[Application API]
    DB[(Private database)]
  end
  User --> WAF
  WAF --> Gateway
  Gateway --> API
  API --> DB`,
  ),
  template(
    "backup-disaster-recovery",
    "Backup and disaster recovery",
    "Cloud and infrastructure",
    "Scheduled backups replicated to a recovery environment and restore workflow.",
    `flowchart LR
  App[Production application] --> DB[(Primary database)]
  DB --> Backup[Scheduled backup]
  Backup --> Vault[(Offsite backup storage)]
  Vault --> Restore[Recovery restore process]
  Restore --> DR[Recovery environment]
  DR --> Verify[Validate restored service]`,
  ),
  template(
    "sql-er",
    "SQL schema ER diagram",
    "Database and data",
    "Users own projects; tasks belong to a project and an owner.",
    `erDiagram
  USER ||--o{ PROJECT : owns
  PROJECT ||--o{ TASK : contains
  USER ||--o{ TASK : assigned
  USER {
    int id PK
    string email
  }
  PROJECT {
    int id PK
    int owner_id FK
    string name
  }
  TASK {
    int id PK
    int project_id FK
    int assignee_id FK
    string title
  }`,
  ),
  template(
    "read-write",
    "Read/write architecture",
    "Database and data",
    "Writes go to a primary store while reads use replicas.",
    `flowchart LR
  Client[Application] --> Router[Read/write router]
  Router -->|writes| Primary[(Primary database)]
  Primary -->|replication| ReplicaA[(Read replica A)]
  Primary -->|replication| ReplicaB[(Read replica B)]
  Router -->|reads| ReplicaA
  Router -->|reads| ReplicaB`,
  ),
  template(
    "replication-sharding",
    "Replication and sharding",
    "Database and data",
    "A shard router distributes keys to shards with replicas.",
    `flowchart LR
  App[Application] --> Router[Shard router]
  Router --> ShardA[(Shard A primary)]
  Router --> ShardB[(Shard B primary)]
  ShardA --> ReplicaA[(Shard A replica)]
  ShardB --> ReplicaB[(Shard B replica)]`,
  ),
  template(
    "data-warehouse",
    "Data warehouse",
    "Database and data",
    "Operational sources flow through a lake and transformations into analytics.",
    `flowchart LR
  CRM[CRM] --> Ingest[Ingestion]
  AppDB[(Application database)] --> Ingest
  Ingest --> Lake[(Data lake)]
  Lake --> Transform[Transform models]
  Transform --> Warehouse[(Data warehouse)]
  Warehouse --> BI[BI dashboards]`,
  ),
  template(
    "etl-elt",
    "ETL/ELT pipeline",
    "Database and data",
    "Extract, load, transform, validate, and publish data for consumers.",
    `flowchart LR
  Sources[Data sources] --> Extract[Extract]
  Extract --> Load[Load raw data]
  Load --> Warehouse[(Warehouse)]
  Warehouse --> Transform[Transform]
  Transform --> Validate[Validate data]
  Validate --> Publish[Publish curated data]
  Publish --> Consumers[Analytics consumers]`,
  ),
];

export function isMermaidDiagramPath(filePath: string): boolean {
  return /\.(mmd|mermaid)$/i.test(filePath);
}

export function shouldConfirmTemplateReplacement(
  currentSource: string,
  templateSource: string,
): boolean {
  return currentSource !== "" && currentSource !== templateSource;
}

export function normalizeGeneratedDiagram(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:mermaid)?\s*\r?\n([\s\S]*?)\r?\n```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

export function extractMermaidProposal(content: string): string | null {
  const fences = content.matchAll(/```(?:mermaid|mmd)\s*\r?\n([\s\S]*?)\r?\n```/gi);
  let proposal: string | null = null;
  for (const fence of fences) {
    const source = fence[1]?.trim();
    if (source) proposal = source;
  }
  return proposal;
}
