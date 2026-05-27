import { getConnectionSource } from '../src/config/database.config';
import { User } from '../src/modules/users/entities/user.entity';
import { Player } from '../src/modules/players/entities/player.entity';
import { VenueManager } from '../src/modules/users/entities/venue-manager.entity';
import { PlayerPosition } from '../src/modules/players/entities/player-position.entity';
import { hashForQuery } from '../src/common/utils/encrypt.util';

const PLAYER_PHONE = '13900139000';
const MANAGER_PHONE = '13700137000';

async function createPlayer() {
  const ds = getConnectionSource();
  await ds.initialize();
  try {
    const userRepo = ds.getRepository(User);
    const playerRepo = ds.getRepository(Player);

    const user = userRepo.create({
      phone: PLAYER_PHONE,
      phoneHash: hashForQuery(PLAYER_PHONE),
      passwordHash: 'player_hash_demo',
      nickname: 'KobeFan',
      userType: 'player',
      status: 'active',
    });
    const savedUser = await userRepo.save(user);

    const player = playerRepo.create({
      userId: savedUser.id,
      age: 25,
      basketballAge: 8,
      gender: 'male',
      height: 185,
      weight: 78.5,
      baseAbilityScore: 72.5,
      matchAdjustValue: 3.0,
    });
    const savedPlayer = await playerRepo.save(player);

    // Add positions
    const posRepo = ds.getRepository(PlayerPosition);
    await posRepo.save(
      posRepo.create({ playerId: savedPlayer.id, position: 'SG', priority: 1 }),
    );
    await posRepo.save(
      posRepo.create({ playerId: savedPlayer.id, position: 'SF', priority: 2 }),
    );

    console.log(`Player User ID: ${savedUser.id}`);
    console.log(`Player Record ID: ${savedPlayer.id}`);
    console.log(`Total Ability Score (auto): ${savedPlayer.totalAbilityScore}`);
  } finally {
    await ds.destroy();
  }
}

async function createVenueManager() {
  const ds = getConnectionSource();
  await ds.initialize();
  try {
    const userRepo = ds.getRepository(User);
    const vmRepo = ds.getRepository(VenueManager);

    const user = userRepo.create({
      phone: MANAGER_PHONE,
      phoneHash: hashForQuery(MANAGER_PHONE),
      passwordHash: 'manager_hash_demo',
      nickname: 'CourtOwner',
      userType: 'venue_manager',
      status: 'active',
    });
    const savedUser = await userRepo.save(user);

    const vm = vmRepo.create({
      userId: savedUser.id,
      companyName: 'Star Court Ltd.',
      contactName: '李四',
      contactPhone: '13700137001',
    });
    const savedVm = await vmRepo.save(vm);

    console.log(`Venue Manager User ID: ${savedUser.id}`);
    console.log(`Venue Manager Record ID: ${savedVm.id}`);
  } finally {
    await ds.destroy();
  }
}

async function updateScore() {
  const ds = getConnectionSource();
  await ds.initialize();
  try {
    const playerRepo = ds.getRepository(Player);
    const userRepo = ds.getRepository(User);

    const user = await userRepo.findOne({
      where: { phoneHash: hashForQuery(PLAYER_PHONE) },
    });
    if (!user) {
      console.log('Player user not found. Run --create-player first.');
      return;
    }

    let player = await playerRepo.findOne({ where: { userId: user.id } });
    if (!player) {
      console.log('Player record not found.');
      return;
    }

    console.log('=== BEFORE Update ===');
    console.log(`Base Score:  ${player.baseAbilityScore}`);
    console.log(`Total Score: ${player.totalAbilityScore}`);

    await playerRepo.update(
      { userId: user.id },
      { baseAbilityScore: 85.0 },
    );

    player = await playerRepo.findOne({ where: { userId: user.id } });
    console.log('=== AFTER Update ===');
    console.log(`Base Score:  ${player?.baseAbilityScore}`);
    console.log(`Total Score: ${player?.totalAbilityScore}`);
  } finally {
    await ds.destroy();
  }
}

async function showRelations() {
  const ds = getConnectionSource();
  await ds.initialize();
  try {
    const userRepo = ds.getRepository(User);
    const playerRepo = ds.getRepository(Player);
    const posRepo = ds.getRepository(PlayerPosition);

    const user = await userRepo.findOne({
      where: { phoneHash: hashForQuery(PLAYER_PHONE) },
    });
    if (!user) {
      console.log('User not found. Run --create-player first.');
      return;
    }

    const player = await playerRepo.findOne({ where: { userId: user.id } });
    if (!player) {
      console.log('Player record not found.');
      return;
    }

    const positions = await posRepo.find({ where: { playerId: player.id } });

    console.log('=== User Profile with Relations ===');
    console.log(`Nickname:     ${user.nickname}`);
    console.log(`User Type:    ${user.userType}`);
    console.log(`Height:       ${player.height} cm`);
    console.log(`Total Score:  ${player.totalAbilityScore}`);
    console.log(
      `Positions:    ${positions.map((p) => p.position).join(', ') || 'N/A'}`,
    );
  } finally {
    await ds.destroy();
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--create-player')) {
    await createPlayer();
  } else if (args.includes('--create-venue-manager')) {
    await createVenueManager();
  } else if (args.includes('--update-score')) {
    await updateScore();
  } else if (args.includes('--show-relations')) {
    await showRelations();
  } else {
    console.log('Usage:');
    console.log('  --create-player        Create a demo player user');
    console.log('  --create-venue-manager Create a demo venue manager user');
    console.log('  --update-score         Update player base score and show auto-calculation');
    console.log('  --show-relations       Show user with player relations');
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
