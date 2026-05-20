import 'dotenv/config';

const base = 'http://localhost:3000';
const productId = 'cmp4f792y00033wesmv7c0jr4';
const warehouseId = 'cmp4f784p00003wes59hh6syd';

async function createReservation(instance: number) {
  const res = await fetch(`${base}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
  });
  const body = await res.json().catch(() => ({}));
  console.log(`create[${instance}] status=${res.status}`, body);
  return { res, body };
}

async function confirmReservation(id: string, instance: number) {
  const res = await fetch(`${base}/api/reservations/${id}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  console.log(`confirm[${instance}] status=${res.status}`, body);
  return { res, body };
}

(async () => {
  console.log('Starting concurrency test');
  const [a, b] = await Promise.all([createReservation(1), createReservation(2)]);
  const idA = a.body?.id;
  const idB = b.body?.id;
  console.log('Created ids', idA, idB);

  if (idA) await confirmReservation(idA, 1);
  if (idB) await confirmReservation(idB, 2);

  console.log('Done');
})();
