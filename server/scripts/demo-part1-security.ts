import { getConnectionSource } from '../src/config/database.config';
import { User } from '../src/modules/users/entities/user.entity';
import { hashForQuery } from '../src/common/utils/encrypt.util';

const DEMO_PHONE = '13800138000';

async function createUser() {
  const ds = getConnectionSource();
  await ds.initialize();
  try {
    const repo = ds.getRepository(User);

    // Check if demo user already exists
    const existing = await repo.findOne({
      where: { phoneHash: hashForQuery(DEMO_PHONE) },
    });
    if (existing) {
      console.log(`Demo user already exists with ID: ${existing.id}`);
      return;
    }

    const user = repo.create({
      phone: DEMO_PHONE,
      phoneHash: hashForQuery(DEMO_PHONE),
      passwordHash: 'demo_hash_for_security_demo',
      nickname: 'SecurityDemo',
      userType: 'player',
      status: 'active',
      realName: '张三',
      idCard: '110101199001011234',
    });
    const saved = await repo.save(user);
    console.log(`Created user ID: ${saved.id}`);
  } finally {
    await ds.destroy();
  }
}

async function verifyDecryption() {
  const ds = getConnectionSource();
  await ds.initialize();
  try {
    const repo = ds.getRepository(User);
    const found = await repo.findOne({
      where: { phoneHash: hashForQuery(DEMO_PHONE) },
    });
    if (!found) {
      console.log('User not found. Run without --verify first.');
      return;
    }
    console.log('=== Decrypted Data (Application View) ===');
    console.log(`Phone:      ${found.phone}`);
    console.log(`Real Name:  ${found.realName}`);
    console.log(`ID Card:    ${found.idCard}`);
  } finally {
    await ds.destroy();
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--verify')) {
    await verifyDecryption();
  } else {
    await createUser();
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
