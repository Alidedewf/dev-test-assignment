import type { Assignment, Branch, Order } from './types.ts';
import { distanceKm } from './geo.ts';


export function almatyDate(iso: string): string {
  const time = new Date(iso).getTime()
  const shifted = new Date(time + 5 * 60 * 60 * 1000)
  return shifted.toISOString().slice(0, 10)
}

export function assignBranch(
  order: Order,
  branches: Branch[],
  isFull: (b: Branch) => boolean = () => false,
): Assignment {
    const picked = pickByRules(order, branches);
    if (picked.rule === 'manual' || picked.branchId === null) return picked;
    const branch = branches.find((b) => b.id === picked.branchId);
    if (branch && !isFull(branch)) return picked;
    const free = branches.filter((b) => b.storeId === order.storeId && b.active && !isFull(b));
    const nearest = findNearest(order, free);
    if (nearest) return { orderId: order.id, branchId: nearest.id, rule: 'geo' };
    return { orderId: order.id, branchId: null, rule: 'unassigned' };
}


function pickByRules(order: Order, branches: Branch[]): Assignment {
  const own = branches.filter((b) => b.storeId === order.storeId && b.active);
  const sameCity = own.filter((b) => b.city == order.city)
  const pointId = order.pickupPointId;
 


  if (order.manualBranchId) {
    const manual = own.find((b) => b.id === order.manualBranchId);
    if (manual) return { orderId: order.id, branchId: manual.id, rule: 'manual' };
  }

  if (own.length === 1) {
    return { orderId: order.id, branchId: own[0].id, rule: 'single' };
  }
  
  if (pointId) {
    const bPoint = own.find((b) => b.pickupPointIds.includes(pointId));
     if(bPoint) return { orderId: order.id, branchId: bPoint.id, rule: 'pickup_point' };
  }
  
  let candidates  = own
  if(sameCity.length == 1) {
    return { orderId: order.id, branchId: sameCity[0].id, rule: 'city' };
  }

  if (sameCity.length > 1) {
    candidates = sameCity
  }

  const nearest = findNearest(order, candidates);
   if (nearest) 
    return { orderId: order.id, branchId: nearest.id, rule: 'geo' };
     return { orderId: order.id, branchId: null, rule: 'unassigned' };
}

function findNearest(order: Order, branches: Branch[]): Branch | null {
  if (order.lat === null || order.lon === null) return null;

  let best: Branch | null = null;
  let bestDist = Infinity;
  for (const b of branches) {
    const d = distanceKm(order.lat, order.lon, b.lat, b.lon);
    if (d < bestDist) {
      best = b;
      bestDist = d;
    }
  }
  return best;
}
