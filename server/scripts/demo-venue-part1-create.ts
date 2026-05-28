import { getConnectionSource } from '../src/config/database.config';
import { User } from '../src/modules/users/entities/user.entity';
import { VenueManager } from '../src/modules/users/entities/venue-manager.entity';
import { Venue } from '../src/modules/venues/entities/venue.entity';
import { hashForQuery } from '../src/common/utils/encrypt.util';

const MANAGER_PHONE = '13700137000';

function checkEnv() {
  const required = ['DB_PASSWORD', 'ENCRYPTION_KEY', 'PHONE_HASH_SECRET'];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Environment variable ${key} is required`);
    }
  }
}

async function createVenue() {
  checkEnv();
  const ds = getConnectionSource();
  await ds.initialize();
  try {
    const userRepo = ds.getRepository(User);
    const vmRepo = ds.getRepository(VenueManager);
    const venueRepo = ds.getRepository(Venue);

    // Check if demo manager already exists
    const existing = await userRepo.findOne({
      where: { phoneHash: hashForQuery(MANAGER_PHONE) },
    });
    if (existing) {
      console.log(`Demo venue manager already exists with user ID: ${existing.id}`);
      const vm = await vmRepo.findOne({ where: { userId: existing.id } });
      if (vm) {
        const venue = await venueRepo.findOne({ where: { managerId: vm.id } });
        if (venue) {
          console.log(`Demo venue already exists with ID: ${venue.id}`);
          printVenueInfo(venue);
          return;
        }
      }
    }

    // Create venue manager user
    const user = userRepo.create({
      phone: MANAGER_PHONE,
      phoneHash: hashForQuery(MANAGER_PHONE),
      passwordHash: 'demo_hash_for_venue_demo',
      nickname: 'StarCourtOwner',
      userType: 'venue_manager',
      status: 'active',
    });
    const savedUser = await userRepo.save(user);
    console.log(`Created venue manager user ID: ${savedUser.id}`);

    // Create venue manager record
    const vm = vmRepo.create({
      userId: savedUser.id,
      companyName: 'Star Court Ltd.',
      contactName: '李四',
      contactPhone: '13700137001',
    });
    const savedVm = await vmRepo.save(vm);
    console.log(`Created venue manager record ID: ${savedVm.id}`);

    // Create venue with full facility info
    const venue = venueRepo.create({
      managerId: savedVm.id,
      name: '星光篮球馆',
      address: '深圳市福田区福华路100号',
      pricePerHour: 280.0,
      courtCount: 2,
      latitude: 22.5431,
      longitude: 114.0579,
      floorMaterial: 'wood',
      lighting: 'LED',
      courtType: 'indoor',
      ventilation: true,
      bigFan: true,
      airCondition: true,
      turnoverTime: 15,
      parking: true,
      restroom: true,
      shower: true,
      lockerRoom: true,
      videoRecord: false,
      status: 'active',
      regionCode: 'shenzhen_futian',
    });
    const savedVenue = await venueRepo.save(venue);
    console.log(`\nCreated venue ID: ${savedVenue.id}`);

    printVenueInfo(savedVenue);
  } finally {
    await ds.destroy();
  }
}

function printVenueInfo(venue: Venue) {
  console.log('\n=== 场地基本信息 ===');
  console.log(`名称:        ${venue.name}`);
  console.log(`地址:        ${venue.address}`);
  console.log(`每小时价格:  ¥${venue.pricePerHour}`);
  console.log(`场地数量:    ${venue.courtCount} 个`);
  console.log(`状态:        ${venue.status}`);
  console.log(`区域:        ${venue.regionCode}`);

  console.log('\n=== 设施配置 ===');
  console.log(`地面材质:    ${venue.floorMaterial === 'wood' ? '木地板' : venue.floorMaterial}`);
  console.log(`灯光:        ${venue.lighting}`);
  console.log(`场地类型:    ${venue.courtType === 'indoor' ? '室内' : venue.courtType}`);
  console.log(`通风:        ${venue.ventilation ? '有' : '无'}`);
  console.log(`大风扇:      ${venue.bigFan ? '有' : '无'}`);
  console.log(`空调:        ${venue.airCondition ? '有' : '无'}`);
  console.log(`翻场时间:    ${venue.turnoverTime} 分钟`);
  console.log(`停车位:      ${venue.parking ? '有' : '无'}`);
  console.log(`洗手间:      ${venue.restroom ? '有' : '无'}`);
  console.log(`淋浴:        ${venue.shower ? '有' : '无'}`);
  console.log(`更衣室:      ${venue.lockerRoom ? '有' : '无'}`);
  console.log(`录像:        ${venue.videoRecord ? '有' : '无'}`);

  console.log('\n=== 评分信息 ===');
  console.log(`平均评分:    ${venue.ratingAvg === null ? '暂无评分' : venue.ratingAvg}`);
  console.log(`评分人数:    ${venue.ratingCount}`);

  console.log('\n=== 坐标信息 (WGS84) ===');
  console.log(`纬度:        ${venue.latitude}`);
  console.log(`经度:        ${venue.longitude}`);
}

async function main() {
  await createVenue();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
