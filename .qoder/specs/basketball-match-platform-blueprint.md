# 篮球匹配平台 — 完整技术方案与需求文档

> 版本：v1.0  
> 日期：2026-05-26  
> 目标平台：iOS + Android（React Native）  
> 团队规模：1-3人  
> MVP支付：模拟支付，后续接入真实通道
>
> **本文档为篮球匹配平台后续开发的指导总纲，技术栈与核心设计已锁定，未经评审不得擅自变更。**

---

## 一、需求优先级划分

### P0 — MVP 核心功能（必须上线）

| 模块 | 功能点 |
|------|--------|
| **1. 注册/登录** | 场地管理方注册、录入场地基本信息（名称、地址、价格、场地列表） |
| | 球员注册、录入篮球天赋属性（年龄、球龄、性别、身高、体重、臂展、站立摸高、起跳摸高、司职位置最多3个） |
| | 系统根据属性计算基础能力值（百分位打分0-100 × 权重求和） |
| | 能力匹配调节值初始化为0，球员可随时修改基础数据 |
| **2. 球员发布比赛意向** | 至少提前1小时提交意向 |
| | 意向包含：开始时间、比赛时长（2-6小时）、可接受等待时长（分钟） |
| | 意向场地和赛制多选（最多3个，按优先级排序） |
| | 提交后可随时取消或修改（仍需满足提前1小时） |
| | 首页显示意向状态：已提交意向等待匹配 |
| **3. 系统自动匹配** | 后台每5分钟执行匹配任务 |
| | 匹配条件：意向时间重叠、意向场地/赛制有重叠、综合能力值差距在动态阈值内 |
| | 动态阈值：意向数量越大，允许的能力差距越小 |
| | 人数达到赛制最低要求即匹配成功，尽量按上限匹配 |
| | 赛制：短赛（先进5球或11分/19分），3v3/4v4/5v5，3-4队 |
| **4. 匹配失败处理** | 到期前3小时未匹配成功 → 通知球员确认是否继续 |
| | 到期前半小时仍未成功 → 自动取消意向 |
| **5. 匹配成功与确认** | 系统生成比赛数据（参赛人员、赛制、开始时间、场地、队伍分配） |
| | 发送通知给所有匹配球员确认 |
| | 确认需缴纳场地费保证金（MVP模拟支付） |
| | 确认截止时间为比赛开始前1小时 |
| | 确认后首页显示：比赛正在等待其他球员确认 |
| **6. 系统确认比赛** | 截止时间后检查确认人数 |
| | 人数足够 → 匹配成功通知、更新首页、通知场地方、自动预订场地时段、建立比赛群聊（有效期一周） |
| | 人数不够 → 匹配失败通知，需重新发送意向 |
| **7. 赛后反馈** | 比赛结束1小时后自动发送反馈邀请 |
| | 反馈内容：总体体验（5级+原因）、对其他每位球员的水平匹配评价、体育道德评价（球品/动作/守时） |
| | 根据反馈计算能力匹配调节值（权重参数化，可后期调整） |

### P1 — 优先延伸功能（P0上线后尽快实现）

| 模块 | 功能点 |
|------|--------|
| **场地详情拓展** | 地面材质、灯光、室内/室外/半室内、通风、大吊扇、空调、翻时间、停车位、厕所、淋浴、更衣室、比赛录像 |
| **场地评分体系** | 球员对球场评价打分 |
| **球员属性拓展** | 卧推重量、手掌长度、跑步成绩（百米/一千米/两千米/五千米）及取得时间 |
| **球队经验** | 高中校队、大学校队、村BA、CUBA、CBA、NBA，主力/替补 |
| **投篮命中率** | 罚球线、三分线，录入格式（投T中Z），滚动累计最近半年数据 |
| **能力等级** | 突破能力、传球能力、防守能力（0-4级），含各级说明 |
| **匹配优化** | 考虑年龄、身高、体重、球品等具体属性参与匹配计算 |
| **预备机制** | 每队多匹配1人作为预备，先到先得确认 |

### P2 — 后续迭代可选功能

| 模块 | 功能点 |
|------|--------|
| **长赛赛制** | 上下半场或4节制，须匹配裁判，2队每队8-12人，自动生成轮换计划 |
| **社交广场** | 按地区自动建立广场（如深圳福田区、上海闵行区），发帖回帖 |
| **私聊功能** | 球员间私聊、通过群聊加好友 |
| **裁判系统** | 裁判注册、裁判证、发送执法意向（时间、场地） |
| **临时场分组** | 不强调个人水平相近，强调每队综合实力均衡、防守对位，打完输比分后重新分队 |

---

## 二、技术栈方案

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     客户端层 (Client)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  iOS App    │  │ Android App │  │  Admin Web (管理后台) │  │
│  │  (Expo)     │  │  (Expo)     │  │  (React)            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / WebSocket
┌──────────────────────────▼──────────────────────────────────┐
│                   网关层 (Gateway)                           │
│              Nginx (反向代理 + SSL + 静态资源)                │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   应用层 (Backend)                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Node.js + NestJS (单体服务)              │    │
│  │  • REST API (业务接口)                               │    │
│  │  • WebSocket (实时通知 + 群聊)                        │    │
│  │  • Cron Job (每5分钟匹配任务)                         │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   数据层 (Data)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  PostgreSQL │  │    Redis    │  │   阿里云 OSS        │  │
│  │  (主数据库)  │  │ (缓存/会话/ │  │   (图片/文件存储)    │  │
│  │             │  │  消息队列)   │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 技术选型与理由

| 层级 | 选型 | 理由 |
|------|------|------|
| **移动端** | React Native (Expo) | 1-3人小团队最优解，一套代码双端运行，Expo托管构建和OTA更新；球员和场地方共用同一个App，按角色区分界面 |
| **管理后台** | React + Ant Design | 快速搭建管理界面，与RN技术栈统一（都是React） |
| **后端框架** | NestJS (Node.js) | 企业级Node框架，内置依赖注入、模块化、TypeORM集成，小团队也能写出规范代码 |
| **数据库** | PostgreSQL | 支持JSON字段、复杂查询、事务完整，后期GIS扩展（按地区匹配）方便 |
| **任务队列** | Bull + Redis | 匹配引擎每5分钟调度，支持任务重试、并发控制、失败隔离 |
| **缓存** | Redis | 缓存热点数据、用户会话、WebSocket房间管理 |
| **对象存储** | 阿里云OSS | 国内访问快，图片处理能力强，成本低 |

| **推送服务** | 极光推送 / 阿里云推送 | 国内推送到达率高，支持iOS/Android统一推送；MVP关键通知同时走App内通知+短信备份 |
| **群聊** | Socket.io + PostgreSQL持久化 | WebSocket实时群聊，消息存数据库，群聊有效期一周 |
| **短信服务** | 阿里云短信 | 注册验证码、通知短信 |
| **部署** | Docker Compose + 阿里云ECS | 小团队运维友好，单台2核4G服务器即可跑完全部服务，月成本约¥200-500 |
| **CI/CD** | GitHub Actions + EAS Build | 自动化构建和发布 |

### 2.3 为什么不选其他方案

| 备选方案 | 不选理由 |
|----------|----------|
| Flutter | 团队若熟悉React则RN上手更快，Expo生态对小团队更友好 |
| 小程序优先 | 用户明确要求iOS+Android App |
| Go/Gin后端 | NestJS的ORM、模块化、装饰器路由开发效率更高，性能足够 |
| MySQL | PostgreSQL的JSONB和数组类型更适合存储球员多位置、意向多选等场景 |
| MongoDB | 关系型数据为主，事务和复杂查询需求多，PostgreSQL更合适 |
| 微服务 | 1-3人维护微服务成本过高，单体+模块化足够支撑到用户量10万+ |
| Serverless | 冷启动和长时间运行任务（匹配算法）体验不佳 |

### 2.4 运维复杂度评估

| 维度 | 评估 | 说明 |
|------|------|------|
| **部署复杂度** | 低 | Docker Compose单文件部署，一台2核4G云服务器即可运行 |
| **监控告警** | 中 | 使用阿里云云监控 + Sentry错误追踪，配置简单 |
| **备份策略** | 低 | PostgreSQL定时自动备份到OSS，Redis持久化+AOF |
| **扩展路径** | 清晰 | 用户量增长后：① 读写分离 ② 匹配任务独立进程 ③ 最终拆分为微服务 |
| **预估月成本** | ¥200-500 | ECS(2核4G) + RDS(可选) + OSS + 短信/推送，初期可全部跑在一台ECS上 |

### 2.5 扩展性设计

- **数据库分区**：所有核心表（users/players/intentions/matches/feedbacks）均含 `region_code` 字段，作为分区键。当单表数据量超过千万级时，可使用 PostgreSQL 声明式分区（Declarative Partitioning）按 `region_code` 或日期范围创建分区表，实现平滑扩展，业务代码无需改动
- **匹配任务优化**：匹配引擎按 `region_code` 并行执行，每个地区独立扫描本地 `pending` 意向，避免全表扫描；`intentions` 表建立复合索引 `(region_code, status, start_time)` 确保扫描效率
- **匹配算法**：独立为可插拔模块，接口化设计，后续可替换为更复杂的算法
- **通知系统**：抽象通知接口，支持推送/短信/站内信多种渠道，新增渠道不影响业务代码
- **支付系统**：抽象支付接口，MVP模拟支付实现该接口，后续接入支付宝/微信只需新增实现类
- **ORM灵活性**：TypeORM处理常规CRUD，复杂查询（如匹配算法的多表关联、聚合计算）预留原生SQL和QueryBuilder接口，避免ORM封装限制性能优化

---

## 三、数据库设计

### 3.1 实体关系概览

```
users (用户基表)
├── venue_managers (场地管理方) 1:1
├── players (球员) 1:1
│   └── player_positions (球员位置) 1:N
│   └── player_shooting_records (投篮记录) 1:N
├── intentions (比赛意向) 1:N
│   └── intention_venues (意向场地) 1:N
│   └── intention_formats (意向赛制) 1:N
├── matches (比赛) N:M (通过 match_players)
│   └── match_teams (比赛队伍) 1:N
│   └── match_players (比赛球员) 1:N
│   └── match_messages (群聊消息) 1:N
├── feedbacks (赛后反馈) 1:N
│   └── feedback_player_ratings (球员互评) 1:N
├── venues (场地) N:1 (venue_managers)
├── venue_time_slots (场地时段) N:1 (venues)
├── formats (赛制) 独立表
└── system_params (系统参数) 独立表
```

### 3.2 数据表结构

#### `users` — 用户基础表
```sql
CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    phone           VARCHAR(255) NOT NULL UNIQUE,  -- AES加密存储，原始长度约20
    password_hash   VARCHAR(255) NOT NULL,
    nickname        VARCHAR(50) NOT NULL,
    real_name       VARCHAR(255),               -- AES加密存储，真实姓名（可选，MVP不强制实名）
    id_card         VARCHAR(255),               -- AES加密存储，身份证号（可选）
    avatar_url      VARCHAR(500),
    user_type       VARCHAR(20) NOT NULL CHECK (user_type IN ('player', 'venue_manager')),
    status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'banned')),
    region_code     VARCHAR(20),                -- 地区编码，预留分区分片
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_type ON users(user_type);
CREATE INDEX idx_users_region ON users(region_code);
```

#### `venue_managers` — 场地管理方
```sql
CREATE TABLE venue_managers (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    company_name    VARCHAR(100),
    contact_name    VARCHAR(50),
    contact_phone   VARCHAR(20),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### `venues` — 场地
```sql
CREATE TABLE venues (
    id              BIGSERIAL PRIMARY KEY,
    manager_id      BIGINT NOT NULL REFERENCES venue_managers(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    address         VARCHAR(255) NOT NULL,
    price_per_hour  DECIMAL(10,2) NOT NULL,
    -- MVP字段
    court_count     INT NOT NULL DEFAULT 1,
    latitude        DECIMAL(10, 8),
    longitude       DECIMAL(11, 8),
    -- P1扩展字段
    floor_material  VARCHAR(50),   -- 地面材质
    lighting        VARCHAR(50),   -- 灯光
    court_type      VARCHAR(20),   -- indoor/outdoor/semi
    ventilation     BOOLEAN DEFAULT FALSE,
    big_fan         BOOLEAN DEFAULT FALSE,
    air_condition   BOOLEAN DEFAULT FALSE,
    turnover_time   INT,           -- 翻场时间(分钟)
    parking         BOOLEAN DEFAULT FALSE,
    restroom        BOOLEAN DEFAULT FALSE,
    shower          BOOLEAN DEFAULT FALSE,
    locker_room     BOOLEAN DEFAULT FALSE,
    video_record    BOOLEAN DEFAULT FALSE,
    -- 评分
    -- CHANGELOG: rating_avg 默认值由 5.00 改为 NULL，避免无评分时误导性展示五星
    rating_avg      DECIMAL(3,2) DEFAULT NULL,
    rating_count    INT DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'active',
    region_code     VARCHAR(20),                -- 地区编码，与分区键一致
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_venues_manager ON venues(manager_id);
CREATE INDEX idx_venues_location ON venues USING GIST (point(longitude, latitude));
CREATE INDEX idx_venues_region ON venues(region_code);
```

#### `venue_time_slots` — 场地可预订时段
```sql
CREATE TABLE venue_time_slots (
    id              BIGSERIAL PRIMARY KEY,
    venue_id        BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    slot_date       DATE NOT NULL,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    is_booked       BOOLEAN DEFAULT FALSE,
    match_id        BIGINT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_slots_venue_date ON venue_time_slots(venue_id, slot_date);
```

#### `players` — 球员
```sql
CREATE TABLE players (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    -- 基础属性 (MVP)
    age                 INT NOT NULL,
    basketball_age      INT NOT NULL,        -- 球龄(年)
    gender              VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
    height              INT NOT NULL,        -- cm
    weight              DECIMAL(5,1),        -- kg
    wingspan            INT,                 -- cm
    standing_reach      INT,                 -- cm 站立摸高
    jumping_reach       INT,                 -- cm 起跳摸高
    -- 计算能力值
    base_ability_score  DECIMAL(5,2) NOT NULL DEFAULT 0,
    match_adjust_value  DECIMAL(5,2) NOT NULL DEFAULT 0,
    total_ability_score DECIMAL(5,2) GENERATED ALWAYS AS (base_ability_score + match_adjust_value) STORED,
    -- P1扩展属性
    bench_press         DECIMAL(5,1),        -- 卧推重量 kg
    hand_length         DECIMAL(4,1),        -- 手掌长度 cm
    sprint_100m         DECIMAL(5,2),        -- 百米成绩(秒)
    run_1000m           DECIMAL(6,2),        -- 千米成绩
    run_2000m           DECIMAL(6,2),
    run_5000m           DECIMAL(6,2),
    run_record_date     DATE,                -- 跑步成绩取得日期
    -- 球队经验
    team_experience     VARCHAR(50)[],       -- 数组: ['high_school', 'college', 'cuba', ...]
    team_role           VARCHAR(20),         -- starter/bench
    -- 能力等级 (P1)
    breakthrough_level  INT DEFAULT 0 CHECK (breakthrough_level BETWEEN 0 AND 4),
    passing_level       INT DEFAULT 0 CHECK (passing_level BETWEEN 0 AND 4),
    defense_level       INT DEFAULT 0 CHECK (defense_level BETWEEN 0 AND 4),
    -- 其他
    region_code         VARCHAR(20),         -- 地区编码，如"shenzhen_futian"
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_players_ability ON players(total_ability_score);
CREATE INDEX idx_players_region ON players(region_code);
```

#### `player_positions` — 球员司职位置
```sql
CREATE TABLE player_positions (
    id          BIGSERIAL PRIMARY KEY,
    player_id   BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    position    VARCHAR(5) NOT NULL CHECK (position IN ('PG', 'SG', 'SF', 'PF', 'C')),
    priority    INT NOT NULL DEFAULT 1,  -- 优先级1=最高
    UNIQUE(player_id, position)
);
```

#### `player_shooting_records` — 投篮记录
```sql
CREATE TABLE player_shooting_records (
    id              BIGSERIAL PRIMARY KEY,
    player_id       BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    record_type     VARCHAR(20) NOT NULL CHECK (record_type IN ('free_throw', 'three_point')),
    shots_attempted INT NOT NULL,
    shots_made      INT NOT NULL,
    record_date     DATE NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_shooting_player ON player_shooting_records(player_id, record_type, record_date);
```

#### `formats` — 赛制
```sql
CREATE TABLE formats (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(50) NOT NULL,       -- 如"3v3短赛"
    format_type     VARCHAR(20) NOT NULL,       -- short / long
    team_size       INT NOT NULL,               -- 每队人数
    team_count_min  INT NOT NULL,               -- 最少队伍数
    team_count_max  INT NOT NULL,               -- 最多队伍数
    win_condition   VARCHAR(100),               -- 先进5球或11分
    duration_hours  DECIMAL(3,1),               -- 预估时长
    description     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### `intentions` — 比赛意向
```sql
CREATE TABLE intentions (
    id                  BIGSERIAL PRIMARY KEY,
    player_id           BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    start_time          TIMESTAMPTZ NOT NULL,       -- 意向开始时间
    duration_minutes    INT NOT NULL CHECK (duration_minutes BETWEEN 120 AND 360),
    acceptable_wait_minutes INT NOT NULL DEFAULT 0, -- 可接受等待时长
    end_time            TIMESTAMPTZ GENERATED ALWAYS AS (start_time + INTERVAL '1 minute' * duration_minutes) STORED,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'matched', 'confirmed', 'cancelled', 'expired', 'failed')),
    match_id            BIGINT,                     -- 匹配成功后关联
    region_code         VARCHAR(20),                -- 分区键：按地区分区，匹配任务按region并行
    submitted_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    expires_at          TIMESTAMPTZ NOT NULL        -- 意向过期时间（用于自动取消）
);
CREATE INDEX idx_intentions_status ON intentions(status);
CREATE INDEX idx_intentions_time ON intentions(start_time, end_time);
CREATE INDEX idx_intentions_player ON intentions(player_id, status);
CREATE INDEX idx_intentions_region_status_time ON intentions(region_code, status, start_time);  -- 匹配任务核心索引
```

#### `intention_venues` — 意向场地（多选）
```sql
CREATE TABLE intention_venues (
    id              BIGSERIAL PRIMARY KEY,
    intention_id    BIGINT NOT NULL REFERENCES intentions(id) ON DELETE CASCADE,
    venue_id        BIGINT NOT NULL REFERENCES venues(id),
    priority        INT NOT NULL DEFAULT 1,     -- 1=最高优先级
    UNIQUE(intention_id, venue_id)
);
```

#### `intention_formats` — 意向赛制（多选）
```sql
CREATE TABLE intention_formats (
    id              BIGSERIAL PRIMARY KEY,
    intention_id    BIGINT NOT NULL REFERENCES intentions(id) ON DELETE CASCADE,
    format_id       BIGINT NOT NULL REFERENCES formats(id),
    priority        INT NOT NULL DEFAULT 1,
    UNIQUE(intention_id, format_id)
);
```

#### `matches` — 比赛
```sql
CREATE TABLE matches (
    id              BIGSERIAL PRIMARY KEY,
    venue_id        BIGINT NOT NULL REFERENCES venues(id),
    format_id       BIGINT NOT NULL REFERENCES formats(id),
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending_confirmation'
                            CHECK (status IN ('pending_confirmation', 'confirmed', 'in_progress', 'completed', 'cancelled', 'failed')),
    team_count      INT NOT NULL,
    players_per_team INT NOT NULL,
    total_players   INT NOT NULL,
    confirmed_players INT DEFAULT 0,
    deposit_amount  DECIMAL(10,2) NOT NULL,     -- 保证金金额
    group_chat_id   VARCHAR(100),               -- 群聊房间ID
    region_code     VARCHAR(20),                -- 分区键，与intentions一致
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_time ON matches(start_time);
CREATE INDEX idx_matches_venue ON matches(venue_id, start_time);
CREATE INDEX idx_matches_region ON matches(region_code);
```

#### `match_players` — 比赛球员关联
```sql
CREATE TABLE match_players (
    id              BIGSERIAL PRIMARY KEY,
    match_id        BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id       BIGINT NOT NULL REFERENCES players(id),
    team_number     INT,                        -- 队伍编号 1,2,3,4
    is_confirmed    BOOLEAN DEFAULT FALSE,      -- 是否确认参赛
    is_reserve      BOOLEAN DEFAULT FALSE,      -- 是否预备队员(P1)
    confirmed_at    TIMESTAMPTZ,
    deposit_paid    BOOLEAN DEFAULT FALSE,      -- 是否已付保证金
    status          VARCHAR(20) DEFAULT 'invited' CHECK (status IN ('invited', 'confirmed', 'declined', 'no_show')),
    UNIQUE(match_id, player_id)
);
CREATE INDEX idx_mp_match ON match_players(match_id);
CREATE INDEX idx_mp_player ON match_players(player_id);
```

#### `match_teams` — 比赛队伍
```sql
CREATE TABLE match_teams (
    id              BIGSERIAL PRIMARY KEY,
    match_id        BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    team_number     INT NOT NULL,
    team_name       VARCHAR(50),                -- 可自动生成如"A队"
    avg_ability     DECIMAL(5,2),               -- 队伍平均能力值
    UNIQUE(match_id, team_number)
);
```

#### `match_messages` — 比赛群聊消息
```sql
CREATE TABLE match_messages (
    id              BIGSERIAL PRIMARY KEY,
    match_id        BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sender_id       BIGINT NOT NULL REFERENCES users(id),
    content         TEXT NOT NULL,
    message_type    VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'system')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messages_match ON match_messages(match_id, created_at);
```

#### `feedbacks` — 赛后反馈
```sql
CREATE TABLE feedbacks (
    id              BIGSERIAL PRIMARY KEY,
    match_id        BIGINT NOT NULL REFERENCES matches(id),
    player_id       BIGINT NOT NULL REFERENCES players(id),
    overall_rating  INT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    overall_reason  VARCHAR(500),
    submitted_at    TIMESTAMPTZ DEFAULT NOW(),
    region_code     VARCHAR(20),                -- 冗余分区键，避免跨区关联查询
    UNIQUE(match_id, player_id)
);
```

#### `feedback_player_ratings` — 对其他球员的评分
```sql
CREATE TABLE feedback_player_ratings (
    id                  BIGSERIAL PRIMARY KEY,
    feedback_id         BIGINT NOT NULL REFERENCES feedbacks(id) ON DELETE CASCADE,
    rated_player_id     BIGINT NOT NULL REFERENCES players(id),
    -- 水平匹配评价
    level_match         VARCHAR(20) CHECK (level_match IN ('unclear', 'lower', 'equal', 'higher')),
    -- 体育道德评价
    sportsmanship       VARCHAR(20) CHECK (sportsmanship IN ('good', 'average', 'poor')),
    action_cleanliness  VARCHAR(20) CHECK (action_cleanliness IN ('clean', 'average', 'dirty')),
    is_punctual         BOOLEAN,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

#### `system_params` — 系统参数表
```sql
CREATE TABLE system_params (
    id              BIGSERIAL PRIMARY KEY,
    param_key       VARCHAR(100) NOT NULL UNIQUE,
    param_value     JSONB NOT NULL,
    description     VARCHAR(255),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 初始数据：能力匹配调节值权重
INSERT INTO system_params (param_key, param_value, description) VALUES
('ability_adjust_weights', '{
    "level_match": {"unclear": 0, "lower": -1, "equal": 0, "higher": 1},
    "sportsmanship": {"good": 1, "average": 0, "poor": -1},
    "action_cleanliness": {"clean": 1, "average": 0, "dirty": -2},
    "punctuality": {"true": 1, "false": -1}
}', '能力匹配调节值计算权重');

-- 初始数据：匹配动态阈值参数
INSERT INTO system_params (param_key, param_value, description) VALUES
('match_threshold_params', '{
    "base_threshold": 20.0,
    "min_threshold": 5.0,
    "intention_count_factor": 0.5
}', '匹配能力值差距动态阈值参数');

-- 初始数据：基础能力值计算权重
INSERT INTO system_params (param_key, param_value, description) VALUES
('base_ability_weights', '{
    "height": 0.15,
    "weight": 0.05,
    "wingspan": 0.10,
    "standing_reach": 0.10,
    "jumping_reach": 0.15,
    "basketball_age": 0.20,
    "age": 0.05,
    "position_fit": 0.20
}', '基础能力值计算权重');
```

#### `notifications` — 通知记录
```sql
CREATE TABLE notifications (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    title           VARCHAR(200) NOT NULL,
    content         TEXT NOT NULL,
    data            JSONB,                      -- 关联数据
    is_read         BOOLEAN DEFAULT FALSE,
    sent_via        VARCHAR(20)[],              -- push, sms, in_app
    region_code     VARCHAR(20),                -- 分区键
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at);
CREATE INDEX idx_notifications_region ON notifications(region_code);
```

### 3.3 分区扩展说明

当单表数据量达到千万级时，可按以下方式启用 PostgreSQL 声明式分区：

```sql
-- 以 intentions 表为例，按 region_code 创建分区
CREATE TABLE intentions_partitioned (
    LIKE intentions INCLUDING ALL
) PARTITION BY LIST (region_code);

-- 为每个地区创建独立分区
CREATE TABLE intentions_sz_futian PARTITION OF intentions_partitioned
    FOR VALUES IN ('shenzhen_futian');

CREATE TABLE intentions_sh_minghang PARTITION OF intentions_partitioned
    FOR VALUES IN ('shanghai_minghang');

-- 默认分区捕获未匹配数据
CREATE TABLE intentions_default PARTITION OF intentions_partitioned DEFAULT;
```

**分区切换策略**：
1. MVP阶段：使用普通表，保留 `region_code` 字段和索引
2. 数据量增长后：创建分区表 → 数据迁移 → 应用层切换表名（或通过视图透明切换）
3. 业务代码无需改动，仅需调整数据库层表结构

**核心表分区优先级**：`intentions` > `matches` > `match_players` > `match_messages` > `feedbacks`

---

## 四、接口定义

### 4.1 接口规范

- **基础路径**: `/api/v1`
- **认证方式**: JWT Bearer Token
- **响应格式**:
```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

### 4.2 模块划分

```
src/
├── modules/
│   ├── auth/              # 认证模块
│   ├── users/             # 用户模块
│   ├── players/           # 球员模块
│   ├── venues/            # 场地模块
│   ├── intentions/        # 意向模块
│   ├── matches/           # 比赛模块
│   ├── matching/          # 匹配引擎模块
│   ├── feedbacks/         # 反馈模块
│   ├── payments/          # 支付模块
│   ├── messages/          # 消息/群聊模块
│   ├── notifications/     # 通知模块
│   └── admin/             # 管理后台模块
```

### 4.3 核心接口列表

#### 认证模块 `/auth`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/register` | 注册（球员/场地方） |
| POST | `/auth/login` | 登录 |
| POST | `/auth/refresh` | 刷新Token |
| POST | `/auth/sms-code` | 发送短信验证码 |

#### 球员模块 `/players`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/players/profile` | 获取个人资料 |
| PUT | `/players/profile` | 更新个人资料与属性 |
| GET | `/players/ability` | 获取能力值详情 |
| POST | `/players/shooting` | 录入投篮记录 |
| GET | `/players/shooting` | 查询投篮统计（滚动半年） |

#### 场地模块 `/venues`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/venues` | 场地方创建场地 |
| GET | `/venues` | 球员查询场地列表 |
| GET | `/venues/:id` | 场地详情 |
| PUT | `/venues/:id` | 更新场地信息 |
| GET | `/venues/:id/slots` | 查询场地可预订时段 |

#### 意向模块 `/intentions`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/intentions` | 提交比赛意向 |
| GET | `/intentions/my` | 我的意向列表 |
| PUT | `/intentions/:id` | 修改意向 |
| DELETE | `/intentions/:id` | 取消意向 |
| GET | `/intentions/:id/status` | 查询意向状态 |

#### 比赛模块 `/matches`

| 方法 | 路径 | 说明 |
|------|------|
| GET | `/matches/my` | 我的比赛列表 |
| GET | `/matches/:id` | 比赛详情 |
| POST | `/matches/:id/confirm` | 确认参赛 |
| POST | `/matches/:id/decline` | 拒绝参赛 |
| GET | `/matches/:id/players` | 参赛球员列表 |
| GET | `/matches/:id/messages` | 群聊消息历史 |
| POST | `/matches/:id/messages` | 发送群聊消息 |

#### 反馈模块 `/feedbacks`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/feedbacks` | 提交赛后反馈 |
| GET | `/feedbacks/pending` | 待反馈列表 |

#### 管理后台 `/admin`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/players` | 球员列表 |
| GET | `/admin/venues` | 场地列表 |
| GET | `/admin/matches` | 比赛列表 |
| GET | `/admin/stats` | 数据统计 |
| PUT | `/admin/params` | 调整系统参数 |

### 4.4 WebSocket 事件

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `match:invited` | Server→Client | 被邀请参赛 |
| `match:confirmed` | Server→Client | 有球员确认参赛 |
| `match:success` | Server→Client | 比赛确认成功 |
| `match:failed` | Server→Client | 比赛人数不足取消 |
| `intention:matched` | Server→Client | 意向匹配成功 |
| `intention:expired` | Server→Client | 意向过期 |
| `message:new` | Server→Client | 新群聊消息 |
| `chat:send` | Client→Server | 发送群聊消息 |

---

## 五、核心算法设计

### 5.1 基础能力值计算模型

```typescript
interface PlayerAttributes {
  height: number;           // cm
  weight: number;           // kg
  wingspan: number;         // cm
  standingReach: number;    // cm
  jumpingReach: number;     // cm
  basketballAge: number;    // 年
  age: number;
  positions: string[];      // ['PG', 'SG']
}

// 每项属性在人群中的百分位打分 (0-100)
// MVP使用预设固定数据集（如中国男性体质监测公开数据）
// 数据集按性别分开存储，如 maleHeightDataset / femaleHeightDataset
function getPercentile(value: number, gender: 'male' | 'female', metric: string): number {
  // 使用预先计算好的固定分位数据集（如中国国民体质监测公开数据）
  // 按性别和指标选择对应数据集
  // 返回 0-100 的百分位得分
}

// 基础能力值计算
function calculateBaseAbility(player: PlayerAttributes): number {
  const weights = {
    height: 0.15,
    weight: 0.05,
    wingspan: 0.10,
    standingReach: 0.10,
    jumpingReach: 0.15,
    basketballAge: 0.20,
    age: 0.05,
    positionFit: 0.20,
  };

  const g = player.gender;
  const scores = {
    height: getPercentile(player.height, g, 'height'),
    weight: getPercentile(player.weight, g, 'weight'),
    wingspan: getPercentile(player.wingspan, g, 'wingspan'),
    standingReach: getPercentile(player.standingReach, g, 'standingReach'),
    jumpingReach: getPercentile(player.jumpingReach, g, 'jumpingReach'),
    basketballAge: getPercentile(player.basketballAge, g, 'basketballAge'),
    age: getPercentile(player.age, g, 'age'),
    positionFit: calculatePositionFit(player.positions),
  };

  let total = 0;
  for (const key of Object.keys(weights)) {
    total += scores[key] * weights[key];
  }
  return Math.round(total * 100) / 100;
}
```

### 5.2 匹配算法流程

```
每5分钟由Bull队列触发：
1. 查询所有 status='pending' 且 start_time > now() + 1小时的意向
2. 按 (意向场地优先级, 意向赛制优先级, 开始时间窗口) 分组
3. 对每个分组：
   a. 获取该分组下所有意向球员的综合能力值
   b. 计算动态阈值：threshold = max(min_threshold, base_threshold - intention_count * factor)
   c. 使用聚类/范围分组算法，将能力值差距在阈值内的球员分到同一候选集
   d. 检查候选集人数是否满足赛制的最低要求
   e. 满足则按能力值均衡原则分配队伍（蛇形选秀算法），生成 match 记录
   f. 更新意向状态为 'matched'，发送通知
4. 处理匹配失败的意向（到期前3小时/半小时逻辑）
5. 匹配任务失败自动重试3次，异常隔离不影响其他分组匹配
```

### 5.3 能力匹配调节值计算

```typescript
function calculateAdjustValue(feedback: Feedback): number {
  const weights = await getSystemParam('ability_adjust_weights');
  let adjust = 0;

  // 水平匹配评价
  adjust += weights.level_match[feedback.level_match];

  // 体育道德评价
  adjust += weights.sportsmanship[feedback.sportsmanship];
  adjust += weights.action_cleanliness[feedback.action_cleanliness];
  adjust += weights.punctuality[String(feedback.is_punctual)];

  return adjust;
}

// 每场比赛结束后，汇总所有对该球员的反馈
async function updatePlayerAdjustValue(playerId: number, matchId: number): Promise<void> {
  const ratings = await getRatingsForPlayer(playerId, matchId);
  const totalAdjust = ratings.reduce((sum, r) => sum + calculateAdjustValue(r), 0);

  // 可以取平均或累加，这里采用累加但有上下限
  await updatePlayer(playerId, {
    match_adjust_value: clamp(currentAdjust + totalAdjust, -50, 50)
  });
}
```

---

## 六、项目目录结构

```
basketball-match-platform/
├── apps/
│   ├── mobile/                    # React Native (Expo) — 球员+场地方共用App
│   │   ├── src/
│   │   │   ├── api/               # API客户端
│   │   │   ├── components/        # 公共组件
│   │   │   ├── screens/           # 页面
│   │   │   │   ├── auth/          # 登录注册（选择角色：球员/场地方）
│   │   │   │   ├── home/          # 首页（按角色展示不同内容）
│   │   │   │   ├── player/        # 球员资料与属性
│   │   │   │   ├── venue-manager/ # 场地方管理后台（App内）
│   │   │   │   ├── venue/         # 场地浏览
│   │   │   │   ├── intention/     # 比赛意向
│   │   │   │   ├── match/         # 比赛
│   │   │   │   └── chat/          # 群聊
│   │   │   ├── stores/            # 状态管理 (Zustand)
│   │   │   ├── hooks/             # 自定义Hooks
│   │   │   ├── utils/             # 工具函数
│   │   │   └── types/             # TypeScript类型
│   │   ├── app.json
│   │   └── package.json
│   │
│   └── admin/                     # 管理后台 (React)
│       ├── src/
│       │   ├── pages/
│       │   ├── components/
│       │   └── api/
│       └── package.json
│
├── server/                        # NestJS 后端
│   ├── src/
│   │   ├── modules/               # 业务模块
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── players/
│   │   │   ├── venues/
│   │   │   ├── intentions/
│   │   │   ├── matches/
│   │   │   ├── matching/          # 匹配引擎
│   │   │   ├── feedbacks/
│   │   │   ├── payments/
│   │   │   ├── messages/
│   │   │   ├── notifications/
│   │   │   └── admin/
│   │   ├── common/                # 公共工具、装饰器、过滤器
│   │   ├── config/                # 配置文件
│   │   └── main.ts
│   ├── docker-compose.yml
│   └── package.json
│
├── shared/                        # 共享类型和常量
│   └── types/
│
└── docs/                          # 文档
    ├── api/                       # API文档
    └── design/                    # 设计稿
```

---

## 六、数据隐私与安全设计

### 6.1 敏感数据加密存储

| 字段 | 加密方式 | 说明 |
|------|----------|------|
| `users.phone` | AES-256-GCM | 手机号加密存储，索引使用HMAC哈希值 |
| `users.real_name` | AES-256-GCM | 真实姓名加密 |
| `users.id_card` | AES-256-GCM | 身份证号加密 |
| `password_hash` | bcrypt (cost=12) | 密码哈希，不可逆 |

**实现要点**：
- 加密密钥通过环境变量注入，不写入代码仓库
- 生产环境使用KMS（阿里云KMS/AWS KMS）管理密钥，支持密钥轮换
- 数据库层存储密文，应用层解密；TypeORM通过自定义Transformer实现自动加解密

```typescript
// 加密Transformer示例
export const EncryptTransformer = {
  to: (value: string) => encrypt(value),      // 入库前加密
  from: (value: string) => decrypt(value),    // 出库后解密
};
```

### 6.2 API响应脱敏规则

| 场景 | 脱敏规则 | 示例 |
|------|----------|------|
| 手机号 | 中间4位隐藏 | `138****8888` |
| 真实姓名 | 仅显示姓氏 | `张**` |
| 身份证号 | 仅显示前3后4 | `110***********1234` |
| 他人手机号 | 完全不可见 | 仅返回 `user_id`，不返回任何联系方式 |

**实现要点**：
- 统一使用拦截器（Interceptor）在响应前自动脱敏
- 管理后台可配置白名单角色（如管理员）查看完整信息
- 球员之间通过App内聊天联系，禁止直接暴露手机号

### 6.3 《个人信息保护法》合规清单

| 要求 | 实施方案 |
|------|----------|
| **告知同意** | 注册页显式展示《隐私政策》，收集敏感信息前单独弹窗获取明示同意 |
| **最小必要** | 仅收集业务必需信息；身份证号、真实姓名MVP阶段不强制收集 |
| **数据安全** | 传输层TLS 1.3加密；存储层AES-256-GCM加密；数据库访问账号最小权限；密钥由KMS托管 |
| **访问控制** | RBAC权限模型；敏感操作记录审计日志（who/what/when） |
| **删除权** | 提供账号注销入口，注销后30天内清除个人数据（保留匿名化统计数据） |
| **第三方共享** | MVP阶段不向任何第三方共享个人数据；后续如接入支付，单独告知并获取同意 |
| **数据跨境** | 服务器部署在中国大陆境内，数据不出境 |

### 6.4 安全加固措施

| 层级 | 措施 |
|------|------|
| **网络** | HTTPS强制；WAF防护；API限流（Rate Limiting） |
| **认证** | JWT短期有效（access_token 2小时，refresh_token 7天）；登录异常检测 |
| **输入** | 全局参数校验（class-validator）；SQL注入防护（参数化查询） |
| **日志** | 敏感字段脱敏后记录；日志保留180天；禁止输出密钥 |
| **部署** | Docker非root运行；数据库不暴露公网；定期安全扫描 |

---

## 七、开发里程碑

| 阶段 | 周期 | 交付物 |
|------|------|--------|
| **Phase 1** | 2周 | 数据库搭建（含分区键与加密字段设计）、认证模块、球员/场地方注册、基础属性录入 |
| **Phase 2** | 2周 | 场地管理、意向提交、匹配引擎核心算法 |
| **Phase 3** | 2周 | 匹配通知、确认参赛、支付保证金（模拟）、系统确认比赛 |
| **Phase 4** | 1周 | 赛后反馈、能力调节值计算、群聊 |
| **Phase 5** | 1周 | 管理后台、测试、Bug修复 |
| **MVP上线** | **8周** | 核心功能完整可用 |

---

## 八、风险与应对

| 风险 | 影响 | 应对策略 |
|------|------|----------|
| 匹配算法效果不佳 | 高 | MVP先上线简单版本，收集数据后迭代优化；预留算法模块接口 |
| 用户冷启动不足 | 高 | 初期聚焦单一城市（如深圳），与场地合作引流；允许球员邀请好友组队 |
| 支付接入延迟 | 中 | MVP使用模拟支付，不影响核心流程验证 |
| 推送到达率 | 中 | 同时使用App内通知+短信备份，关键节点双重通知 |
| 场地资源不足 | 中 | 优先签约3-5个核心场地，验证模式后再扩展 |

---

## 九、技术栈锁定声明

> **本方案确定后，MVP阶段技术栈不做变更。**
>
> - 移动端：React Native (Expo)
> - 后端：NestJS + TypeScript
> - 数据库：PostgreSQL + Redis
> - 部署：Docker + 阿里云ECS
>
> 如需变更，须经技术评审并更新本文档。
