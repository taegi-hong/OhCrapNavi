import { RestroomCandidate, UserCoordinates } from '../types';

export const INITIAL_USER_LOCATION: UserCoordinates = {
  lat: 37.49795,
  lng: 127.02761,
  address: '강남역 2번 출구 부근',
  accuracy: 'GPS 대기 중',
  isLiveGps: false,
};

export const ALTERNATIVE_LOCATIONS: UserCoordinates[] = [
  {
    lat: 37.49795,
    lng: 127.02761,
    address: '강남역 2번 출구 (테헤란로)',
    accuracy: '프리셋 ±2m',
    isLiveGps: false,
  },
  {
    lat: 37.50063,
    lng: 127.03648,
    address: '역삼역 3번 출구 (GS타워 앞)',
    accuracy: '프리셋 ±3m',
    isLiveGps: false,
  },
  {
    lat: 37.50380,
    lng: 127.02420,
    address: '신논현역 6번 출구 (교보타워 앞)',
    accuracy: '프리셋 ±2m',
    isLiveGps: false,
  },
  {
    lat: 37.55620,
    lng: 126.92390,
    address: '홍대입구역 9번 출구 (어울마당로)',
    accuracy: '프리셋 ±2.5m',
    isLiveGps: false,
  },
];

export const CANDIDATE_RESTROOMS: RestroomCandidate[] = [
  {
    id: 'restroom-1',
    name: '역삼빌딩 1층 개방 화장실',
    lat: 37.49885,
    lng: 127.02845,
    distance_meters: 120,
    walking_time_min: 2,
    is_open: true,
    floor_or_location_details: '1층 로비 우측 복도 끝',
    door_code: 'FREE',
    has_password: false,
    access_notes: '회전문 통과 ➜ 엘리베이터 우측 복도 끝 ➜ 첫 번째 출입문',
    indoor_steps: [
      '건물 중앙 대형 회전문을 통과하세요.',
      '인포메이션 데스크를 지나 엘리베이터 홀 우측 복도로 진입하세요.',
      '복도 끝 표지판이 보이는 첫 번째 문이 개방 화장실입니다.',
    ],
    cleanliness_score: 4.9,
    stalls_total: 4,
    stalls_available: 3,
    queue_count: 0,
    gender_separated: true,
    wheelchair_accessible: true,
    baby_facility: true,
    open_hours: '24시간 개방',
    verified: true,
    radar_x: 28,
    radar_y: 26,
  },
  {
    id: 'restroom-2',
    name: '스타벅스 강남R점',
    lat: 37.49962,
    lng: 127.02678,
    distance_meters: 280,
    walking_time_min: 4,
    is_open: true,
    floor_or_location_details: '2층 리저브 바 안쪽',
    door_code: '7721#',
    has_password: true,
    access_notes: '주 출입구 진입 후 내부 계단 또는 엘리베이터 2층 이용 (영수증 하단 7721#)',
    indoor_steps: [
      '스타벅스 정문 자동문으로 진입합니다.',
      '중앙 원형 계단을 통해 2층으로 올라가세요.',
      '리저브 바 카운터 좌측 통로 끝에 도어락 화장실이 있습니다.',
    ],
    cleanliness_score: 4.8,
    stalls_total: 3,
    stalls_available: 2,
    queue_count: 1,
    gender_separated: true,
    wheelchair_accessible: false,
    baby_facility: false,
    open_hours: '07:00 ~ 23:00',
    verified: true,
    radar_x: 78,
    radar_y: 34,
  },
  {
    id: 'restroom-3',
    name: '강남역 지하상가 공용화장실',
    lat: 37.49712,
    lng: 127.02795,
    distance_meters: 350,
    walking_time_min: 5,
    is_open: true,
    floor_or_location_details: '지하 1층 9-10번 출구 사이',
    door_code: 'FREE',
    has_password: false,
    access_notes: '지하철 역사 진입 후 9번 출구 방면 공용 화장실',
    indoor_steps: [
      '강남역 2번 출구 에스컬레이터를 타고 지하로 내려갑니다.',
      '지하상가 중앙 통로를 따라 9번 출구 방면으로 직진하세요.',
      '지하철 개찰구 외부 개방 화장실 표지판을 확인하세요.',
    ],
    cleanliness_score: 4.1,
    stalls_total: 8,
    stalls_available: 4,
    queue_count: 2,
    gender_separated: true,
    wheelchair_accessible: true,
    baby_facility: true,
    open_hours: '05:30 ~ 24:00',
    verified: true,
    radar_x: 18,
    radar_y: 72,
  },
  {
    id: 'restroom-4',
    name: '교보타워 B동 고객화장실',
    lat: 37.50380,
    lng: 127.02420,
    distance_meters: 410,
    walking_time_min: 6,
    is_open: true,
    floor_or_location_details: '지하 1층 서점 방향 복도',
    door_code: 'FREE',
    has_password: false,
    access_notes: '타워 B동 에스컬레이터 하강 후 직진',
    indoor_steps: [
      '교보타워 B동 회전문으로 들어갑니다.',
      '하행 에스컬레이터를 타고 지하 1층으로 내려가세요.',
      '서점 입구 맞은편 고객용 화장실로 직진하세요.',
    ],
    cleanliness_score: 4.9,
    stalls_total: 6,
    stalls_available: 5,
    queue_count: 0,
    gender_separated: true,
    wheelchair_accessible: true,
    baby_facility: true,
    open_hours: '10:00 ~ 22:00',
    verified: true,
    radar_x: 65,
    radar_y: 80,
  },
];

// Haversine distance formula
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.max(15, Math.round(R * c));
}

// Recalculates candidate distances relative to user coordinates
export function recalculateDistances(
  userLat: number,
  userLng: number,
  restrooms: RestroomCandidate[] = CANDIDATE_RESTROOMS
): RestroomCandidate[] {
  return restrooms
    .map((r) => {
      const dist = calculateDistanceMeters(userLat, userLng, r.lat, r.lng);
      const walkingTime = Math.max(1, Math.ceil(dist / 65));
      return {
        ...r,
        distance_meters: dist,
        walking_time_min: walkingTime,
      };
    })
    .sort((a, b) => a.distance_meters - b.distance_meters);
}
