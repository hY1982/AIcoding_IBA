# Module 1.1 验收演示脚本计划

## Context
Module 1.1（用户与认证实体）已完成编码和审核修复。现需要为非技术负责人执行一场验收演示，展示数据安全、核心功能和代码质量三大维度。

## 关键前提条件
- PostgreSQL 已运行，数据库 `basketball_platform` 已存在
- `.env` 中 `DB_PASSWORD` 为空，`ENCRYPTION_KEY` 和 `PHONE_HASH_SECRET` 缺失
- 迁移尚未运行（数据库为空）

## 执行计划

### Phase 0: 环境准备（3 分钟）

**Step 0.1 — 安全生成临时密钥并配置 `.env`**
- 文件: `server/.env`
- 操作:
  1. 生成临时加密密钥: `openssl rand -base64 32`（或 `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`）
  2. 生成临时 phone hash secret: `demo-secret-$(date +%s)`
  3. 修改 `.env`:
     - `DB_PASSWORD=` → 填入实际的 PostgreSQL 密码
     - 添加 `ENCRYPTION_KEY=<刚才生成的base64密钥>`
     - 添加 `PHONE_HASH_SECRET=<刚才生成的secret>`
- 安全说明: 演示结束后这些临时密钥即失效，不会在任何文档中硬编码留存

**Step 0.2 — 验证 PostgreSQL 可连接**
- 命令: `psql -U postgres -d basketball_platform -c "SELECT 1;"`
- 预期输出: 单行 `1`
- 如失败，检查 PostgreSQL 服务是否运行、密码是否正确

**Step 0.3 — 预检查迁移状态**
- 命令: `npx typeorm-ts-node-commonjs migration:show -d src/data-source.ts`
- 预期: 显示 `[ ] InitUserAndPlayerEntities1779874031321`（未执行）
- 如已执行，先回滚: `npx typeorm-ts-node-commonjs migration:revert -d src/data-source.ts`

### Part 1: 数据安全演示（5 分钟）

**Step 1.1 — 运行迁移创建表结构**
- 命令（server 目录）:
  ```bash
  npx typeorm-ts-node-commonjs migration:run -d src/data-source.ts
  ```
- 预期输出: `Migration InitUserAndPlayerEntities1779874031321 has been executed successfully.`
- 向负责人说明: "这是数据库结构的版本控制，所有表、索引、外键都由代码定义并自动创建。"

**Step 1.2 — 执行预置演示脚本：插入敏感数据**
- 运行: `npx ts-node -r tsconfig-paths/register scripts/demo-part1-security.ts`
- 脚本功能:
  1. 连接数据库
  2. 创建 User 实体: phone='13800138000', realName='张三', idCard='110101199001011234'
  3. phoneHash 通过 `hashForQuery('13800138000')` 计算
  4. 保存后输出: `Created user ID: X`
- 向负责人说明: "我们创建了一个包含真实手机号、真实姓名和身份证号用户。但数据库永远不会看到明文。"

**Step 1.3 — 用 psql 查看数据库中的加密乱码**
- 命令:
  ```sql
  SELECT id, phone, real_name, id_card, phone_hash FROM users WHERE id = 1;
  ```
- 预期输出: phone/real_name/id_card 显示为 `v1:xxx:xxx:xxx` 格式的密文；phone_hash 为 64 位十六进制字符串
- 向负责人说明: "黑客即使直接拿到数据库，看到的也是乱码。没有 ENCRYPTION_KEY，这些数据无法还原。"

**Step 1.4 — 用 TypeORM 读取并自动解密**
- 运行: `npx ts-node -r tsconfig-paths/register scripts/demo-part1-security.ts --verify`
- 脚本通过 `phoneHash` 查找用户并打印 phone/realName/idCard
- 预期输出: 明文 `13800138000`、`张三`、`110101199001011234`
- 向负责人说明: "应用程序读取时自动解密，开发者完全无感知。数据库看到的是乱码，应用看到的是明文。"

### Part 2: 核心功能演示（10 分钟）

**Step 2.1 — 创建球员用户**
- 运行: `npx ts-node -r tsconfig-paths/register scripts/demo-part2-core.ts --create-player`
- 脚本创建 User(userType='player') + Player 扩展记录
- Player 数据: age=25, height=185, baseAbilityScore=72.5, matchAdjustValue=3.0
- 输出: 用户 ID、球员记录 ID、自动计算的总能力分
- 预期 totalAbilityScore: 75.50

**Step 2.2 — 创建场地经理用户**
- 运行: `npx ts-node -r tsconfig-paths/register scripts/demo-part2-core.ts --create-venue-manager`
- 脚本创建 User(userType='venue_manager') + VenueManager 扩展记录
- VenueManager 数据: companyName='Star Court Ltd.', contactName='李四'
- 输出: 用户 ID、场地方记录 ID

**Step 2.3 — psql 展示 user_type 区别**
- 命令:
  ```sql
  SELECT id, nickname, user_type, status FROM users ORDER BY id;
  ```
- 预期输出: 3 行数据，user_type 分别为 player/player/venue_manager
- 向负责人说明: "同一张 users 表容纳两种身份，user_type 字段区分。"

**Step 2.4 — psql 展示扩展表数据**
- players 表查询: `SELECT user_id, age, height, base_ability_score, match_adjust_value, total_ability_score FROM players;`
- venue_managers 表查询: `SELECT user_id, company_name, contact_name FROM venue_managers;`
- 向负责人说明: "球员有身高、能力分等运动数据；场地方有公司名、联系人等商业数据。"

**Step 2.5 — 修改基础能力分，展示自动更新**
- 运行: `npx ts-node -r tsconfig-paths/register scripts/demo-part2-core.ts --update-score`
- 将 player 的 baseAbilityScore 从 72.5 更新为 85.0
- 重新读取并打印 baseAbilityScore 和 totalAbilityScore
- 预期: BEFORE 显示 72.5/75.50；AFTER 显示 85.0/88.00
- 向负责人说明: "total_ability_score 是数据库自动计算的，修改基础分后总分立即更新，没有任何应用代码参与，杜绝计算错误。"

**Step 2.6 — 【高光演示】计算列防破坏保护**
- 命令:
  ```sql
  UPDATE players SET total_ability_score = 999.99 WHERE user_id = 2;
  ```
- 预期输出: `ERROR:  column "total_ability_score" is a generated column`
- 向负责人说明: "任何人——包括数据库管理员——都无法手动篡改总分。数据库本身强制执行计算规则，确保数据100%可靠。这是业务规则在数据库层面的终极保障。"

**Step 2.7 — 【增强演示】关联数据一键查询**
- 运行: `npx ts-node -r tsconfig-paths/register scripts/demo-part2-core.ts --show-relations`
- 脚本通过 TypeORM relations 一次性查询用户及其球员数据、位置偏好
- 预期输出: 用户昵称、身高、总能力分、擅长位置列表
- 向负责人说明: "通过对象关系映射，一行代码就能拿到用户所有关联信息。不需要手写复杂的 SQL 拼接。"

### Part 3: 质量报告（3 分钟）

**Step 3.1 — 测试覆盖率报告**
- 命令: `npm test -- --runInBand --coverage`
- 预期: 9 suites passed, 69 tests passed, 覆盖率全部 >80%
- 展示文本输出给负责人
- 业务解读话术: "69 个自动化测试覆盖了我们核心数据模型的所有功能。每次代码修改都会自动验证加密解密、数据库约束、能力分计算等业务规则，从代码层面保证您业务规则的长期稳定。"

**Step 3.2 — TypeScript 编译零错误**
- 命令: `npm run build`
- 预期: `✔ Compiled successfully` 或无错误输出
- 展示输出给负责人
- 业务解读话术: "TypeScript 在编译阶段就捕获类型错误，防止运行时崩溃。这意味着更少的线上故障和更稳定的用户体验。"

**Step 3.3 — ESLint 零错误**
- 命令: `npx eslint "src/**/*.ts" --max-warnings=0`
- 预期: 无输出（0 errors, 0 warnings）
- 展示结果给负责人
- 业务解读话术: "代码规范检查确保团队所有成员遵循统一的编码标准，降低维护成本，让新成员快速上手。"

### Phase 4: 清理（可选）

**Step 4.1 — 回滚迁移（如需重置数据库）**
- 命令: `npx typeorm-ts-node-commonjs migration:revert -d src/data-source.ts`
- 预期: 所有表被删除，数据库恢复为空

## 需要创建/修改的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `server/.env` | 编辑 | 添加 DB_PASSWORD、ENCRYPTION_KEY、PHONE_HASH_SECRET（演示前临时生成） |
| `server/src/data-source.ts` | 已存在 | TypeORM CLI 使用的 DataSource 导出 |
| `server/scripts/demo-part1-security.ts` | **新建** | Part 1 数据安全演示脚本：创建用户、验证加密解密 |
| `server/scripts/demo-part2-core.ts` | **新建** | Part 2 核心功能演示脚本：创建球员/场地方、更新能力分、展示关联查询 |

### 脚本文件设计要点

**`demo-part1-security.ts`**
- 支持 `--verify` 参数切换模式
- 无参数时：创建演示用户并输出 ID
- `--verify` 时：通过 phoneHash 查找用户并打印明文字段
- 包含错误处理：数据库连接失败、重复手机号等

**`demo-part2-core.ts`**
- 支持参数: `--create-player`、`--create-venue-manager`、`--update-score`、`--show-relations`
- `--create-player`: 创建球员用户 + Player 记录，输出 totalAbilityScore
- `--create-venue-manager`: 创建场地方用户 + VenueManager 记录
- `--update-score`: 更新 baseAbilityScore，展示 BEFORE/AFTER
- `--show-relations`: 通过 `relations: ['player', 'player.positions']` 查询并输出用户完整信息
- 包含错误处理：用户不存在、重复数据等

## 验证清单

- [ ] `.env` 配置正确（密钥临时生成，非硬编码），psql 可连接
- [ ] 迁移状态预检查通过（未执行或已回滚）
- [ ] 迁移成功执行，`\dt` 显示 4 张表
- [ ] 加密演示: DB 中 phone/real_name/id_card 为密文，TypeORM 读取为明文
- [ ] 两个测试用户创建成功，user_type 区分正确
- [ ] 球员能力分更新后，total_ability_score 自动同步
- [ ] 【高光】psql 直接 UPDATE total_ability_score 报错（生成列保护）
- [ ] 【增强】关联数据一键查询成功展示
- [ ] 69 个测试全部通过，覆盖率 >80%
- [ ] `npm run build` 零错误
- [ ] `npx eslint` 零错误

## 风险应对速查表

| 场景 | 应对措施 |
|------|----------|
| 迁移已执行过 | Step 0.3 先执行 `migration:revert` 回滚 |
| 演示脚本报错 | 脚本内置错误处理，控制台输出友好提示 |
| psql 连接失败 | 检查 `.env` 中 DB_PASSWORD 是否与 PostgreSQL 实际密码一致 |
| 重复手机号冲突 | 脚本使用固定演示手机号，如已存在则先清理或改用其他号码 |
| 覆盖率不达标 | 当前代码基线 93%+/86%+/91%+/93%+，远低于 80% 阈值的风险极低 |

## 演示时间预估

| 阶段 | 时间 |
|------|------|
| Phase 0: 环境准备 | 3 分钟 |
| Part 1: 数据安全 | 5 分钟 |
| Part 2: 核心功能 | 10 分钟 |
| Part 3: 质量报告 | 3 分钟 |
| **总计** | **约 21 分钟** |
