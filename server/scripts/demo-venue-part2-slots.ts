import { getConnectionSource } from '../src/config/database.config';
import { User } from '../src/modules/users/entities/user.entity';
import { VenueManager } from '../src/modules/users/entities/venue-manager.entity';
import { Venue } from '../src/modules/venues/entities/venue.entity';
import { VenueTimeSlot } from '../src/modules/venues/entities/venue-time-slot.entity';
import { hashForQuery } from '../src/common/utils/encrypt.util';

const MANAGER_PHONE = '13700137000';
const CASCADE_MANAGER_PHONE = '13700137002';

function checkEnv() {
  const required = ['DB_PASSWORD', 'ENCRYPTION_KEY', 'PHONE_HASH_SECRET'];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Environment variable ${key} is required`);
    }
  }
}

async function createSlots() {
  checkEnv();
  const ds = getConnectionSource();
  await ds.initialize();
  try {
    const userRepo = ds.getRepository(User);
    const venueRepo = ds.getRepository(Venue);
    const slotRepo = ds.getRepository(VenueTimeSlot);

    const user = await userRepo.findOne({
      where: { phoneHash: hashForQuery(MANAGER_PHONE) },
    });
    if (!user) {
      console.log('Venue manager not found. Run demo-venue-part1-create.ts first.');
      return;
    }

    const vm = await ds.getRepository(VenueManager).findOne({
      where: { userId: user.id },
    });
    if (!vm) {
      console.log('Venue manager record not found.');
      return;
    }

    const venue = await venueRepo.findOne({ where: { managerId: vm.id } });
    if (!venue) {
      console.log('Venue not found.');
      return;
    }

    // Check if slots already exist
    const existingSlots = await slotRepo.find({ where: { venueId: venue.id } });
    if (existingSlots.length > 0) {
      console.log(`Slots already exist for venue ${venue.id}:`);
      existingSlots.forEach((s) => {
        console.log(`  [${s.id}] ${s.slotDate} ${s.startTime}-${s.endTime} (booked: ${s.isBooked})`);
      });
      return;
    }

    const slots = [
      { slotDate: '2026-06-15', startTime: '09:00:00', endTime: '11:00:00' },
      { slotDate: '2026-06-15', startTime: '14:00:00', endTime: '16:00:00' },
      { slotDate: '2026-06-15', startTime: '19:00:00', endTime: '21:00:00' },
    ];

    console.log(`Creating ${slots.length} time slots for venue "${venue.name}"...\n`);

    for (const slotData of slots) {
      const slot = slotRepo.create({
        venueId: venue.id,
        ...slotData,
      });
      const saved = await slotRepo.save(slot);
      console.log(`  [${saved.id}] ${saved.slotDate} ${saved.startTime} - ${saved.endTime} | 已预订: ${saved.isBooked}`);
    }

    console.log('\nAll slots created successfully!');
  } finally {
    await ds.destroy();
  }
}

async function cascadeDemo() {
  checkEnv();
  const ds = getConnectionSource();
  await ds.initialize();
  try {
    const userRepo = ds.getRepository(User);
    const venueRepo = ds.getRepository(Venue);
    const slotRepo = ds.getRepository(VenueTimeSlot);

    const user = await userRepo.findOne({
      where: { phoneHash: hashForQuery(MANAGER_PHONE) },
    });
    if (!user) {
      console.log('Venue manager not found. Run demo-venue-part1-create.ts first.');
      return;
    }

    const vm = await ds.getRepository(VenueManager).findOne({
      where: { userId: user.id },
    });
    if (!vm) {
      console.log('Venue manager record not found.');
      return;
    }

    const venue = await venueRepo.findOne({
      where: { managerId: vm.id },
      relations: ['timeSlots'],
    });
    if (!venue) {
      console.log('Venue not found.');
      return;
    }

    const slotCount = venue.timeSlots?.length || 0;
    console.log('=== BEFORE: 删除场地前 ===');
    console.log(`场地: ${venue.name} (ID: ${venue.id})`);
    console.log(`关联时段数量: ${slotCount}`);
    if (venue.timeSlots) {
      venue.timeSlots.forEach((s) => {
        console.log(`  - [${s.id}] ${s.slotDate} ${s.startTime}-${s.endTime}`);
      });
    }

    // Delete venue and cascade delete slots
    await venueRepo.remove(venue);

    console.log('\n=== AFTER: 删除场地后 ===');
    const remainingSlots = await slotRepo.find({ where: { venueId: venue.id } });
    console.log(`场地 "${venue.name}" 已删除`);
    console.log(`剩余关联时段数量: ${remainingSlots.length}`);
    if (remainingSlots.length === 0) {
      console.log('所有关联时段已自动清理，无孤儿数据！');
    }
  } finally {
    await ds.destroy();
  }
}

async function cascadeManagerDemo() {
  checkEnv();
  const ds = getConnectionSource();
  await ds.initialize();
  try {
    const userRepo = ds.getRepository(User);
    const vmRepo = ds.getRepository(VenueManager);
    const venueRepo = ds.getRepository(Venue);
    const slotRepo = ds.getRepository(VenueTimeSlot);

    // Create a temporary manager and venue for cascade demo
    let user = await userRepo.findOne({
      where: { phoneHash: hashForQuery(CASCADE_MANAGER_PHONE) },
    });

    let vm: VenueManager | null = null;
    let venue: Venue | null = null;

    if (!user) {
      user = await userRepo.save(
        userRepo.create({
          phone: CASCADE_MANAGER_PHONE,
          phoneHash: hashForQuery(CASCADE_MANAGER_PHONE),
          passwordHash: 'demo_cascade_hash',
          nickname: 'TempOwner',
          userType: 'venue_manager',
          status: 'active',
        }),
      );
      vm = await vmRepo.save(
        vmRepo.create({
          userId: user.id,
          companyName: 'Temp Court Co.',
          contactName: '临时负责人',
        }),
      );
      venue = await venueRepo.save(
        venueRepo.create({
          managerId: vm.id,
          name: '临时测试场地',
          address: '临时地址',
          pricePerHour: 100.0,
        }),
      );
      await slotRepo.save(
        slotRepo.create({
          venueId: venue.id,
          slotDate: '2026-06-20',
          startTime: '10:00:00',
          endTime: '12:00:00',
        }),
      );
    } else {
      vm = await vmRepo.findOne({ where: { userId: user.id } });
      if (vm) {
        venue = await venueRepo.findOne({ where: { managerId: vm.id } });
      }
    }

    if (!user || !vm || !venue) {
      console.log('Failed to prepare cascade demo data.');
      return;
    }

    const slotCount = await slotRepo.count({ where: { venueId: venue.id } });

    console.log('=== BEFORE: 删除场地方前 ===');
    console.log(`场地方用户: ${user.nickname} (ID: ${user.id})`);
    console.log(`场地: ${venue.name} (ID: ${venue.id})`);
    console.log(`关联时段数量: ${slotCount}`);

    // Delete venue manager (cascade to user -> venue -> slots)
    await vmRepo.remove(vm);
    await userRepo.remove(user);

    console.log('\n=== AFTER: 删除场地方后 ===');
    const remainingVenue = await venueRepo.findOne({ where: { id: venue.id } });
    const remainingSlots = await slotRepo.find({ where: { venueId: venue.id } });
    console.log(`场地方 "${user.nickname}" 已删除`);
    console.log(`场地是否存在: ${remainingVenue ? '是' : '否（已自动清理）'}`);
    console.log(`剩余关联时段数量: ${remainingSlots.length}`);
    if (!remainingVenue && remainingSlots.length === 0) {
      console.log('场地方注销后，所有场地和时段数据已自动清理！');
    }
  } finally {
    await ds.destroy();
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--create-slots')) {
    await createSlots();
  } else if (args.includes('--cascade-demo')) {
    await cascadeDemo();
  } else if (args.includes('--cascade-manager')) {
    await cascadeManagerDemo();
  } else {
    console.log('Usage:');
    console.log('  --create-slots     Create 3 time slots for demo venue');
    console.log('  --cascade-demo     Delete venue and show slots auto-cleanup');
    console.log('  --cascade-manager  Delete venue manager and show cascade cleanup');
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
