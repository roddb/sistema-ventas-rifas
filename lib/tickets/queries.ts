import { db, schema } from '../db';
import { eq, and, asc, sql, inArray } from 'drizzle-orm';

const { orders, purchases, purchaseNumbers, raffleNumbers, comboPurchases, comboPurchaseItems } = schema;

export interface FamilyIdentity {
  buyerName: string;
  studentName: string | null;
  course: string | null;
  division: string | null;
}

export interface RaffleTicket {
  number: number;
}

export interface ComboTicket {
  comboId: string;
  comboNameSnapshot: string;
  quantity: number;
}

export interface OrderTicketData {
  orderId: string;
  family: FamilyIdentity;
  rifas: RaffleTicket[];
  combos: ComboTicket[];
}

export interface TicketsSummaryRow {
  orderId: string;
  buyerName: string;
  studentName: string | null;
  course: string | null;
  division: string | null;
  numCount: number;
  comboUnitsCount: number;
}

export async function getAllApprovedOrderIds(): Promise<string[]> {
  const rows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.paymentStatus, 'approved'))
    .orderBy(asc(orders.buyerName));
  return rows.map((r: { id: string }) => r.id);
}

export async function getOrderForTicket(orderId: string): Promise<OrderTicketData | null> {
  const [orderRows, rifaRows, comboRows] = await Promise.all([
    db
      .select({
        id: orders.id,
        buyerName: orders.buyerName,
        studentName: orders.studentName,
        course: orders.course,
        division: orders.division,
        paymentStatus: orders.paymentStatus,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1),

    db
      .select({ number: raffleNumbers.number })
      .from(purchases)
      .innerJoin(purchaseNumbers, eq(purchaseNumbers.purchaseId, purchases.id))
      .innerJoin(raffleNumbers, eq(raffleNumbers.id, purchaseNumbers.raffleNumberId))
      .where(and(eq(purchases.orderId, orderId), eq(purchases.paymentStatus, 'approved')))
      .orderBy(asc(raffleNumbers.number)),

    db
      .select({
        comboId: comboPurchaseItems.comboId,
        comboNameSnapshot: comboPurchaseItems.comboNameSnapshot,
        quantity: comboPurchaseItems.quantity,
      })
      .from(comboPurchases)
      .innerJoin(comboPurchaseItems, eq(comboPurchaseItems.comboPurchaseId, comboPurchases.id))
      .where(and(eq(comboPurchases.orderId, orderId), eq(comboPurchases.paymentStatus, 'approved')))
      .orderBy(asc(comboPurchaseItems.id)),
  ]);

  const orderRow = orderRows[0];
  if (!orderRow || orderRow.paymentStatus !== 'approved') return null;

  return {
    orderId: orderRow.id,
    family: {
      buyerName: orderRow.buyerName,
      studentName: orderRow.studentName,
      course: orderRow.course,
      division: orderRow.division,
    },
    rifas: rifaRows.map((r: { number: number }) => ({ number: r.number })),
    combos: comboRows.map((c: { comboId: string; comboNameSnapshot: string; quantity: number }) => ({
      comboId: c.comboId,
      comboNameSnapshot: c.comboNameSnapshot,
      quantity: c.quantity,
    })),
  };
}

export async function getAdminTicketsSummary(): Promise<TicketsSummaryRow[]> {
  const orderRows = await db
    .select({
      orderId: orders.id,
      buyerName: orders.buyerName,
      studentName: orders.studentName,
      course: orders.course,
      division: orders.division,
    })
    .from(orders)
    .where(eq(orders.paymentStatus, 'approved'))
    .orderBy(asc(orders.buyerName));

  if (orderRows.length === 0) return [];

  const orderIds = orderRows.map((r: { orderId: string }) => r.orderId);

  const [rifaCounts, comboCounts] = await Promise.all([
    db
      .select({
        orderId: purchases.orderId,
        count: sql<number>`COUNT(*)`,
      })
      .from(purchases)
      .innerJoin(purchaseNumbers, eq(purchaseNumbers.purchaseId, purchases.id))
      .where(
        and(
          eq(purchases.paymentStatus, 'approved'),
          inArray(purchases.orderId, orderIds)
        )
      )
      .groupBy(purchases.orderId),

    db
      .select({
        orderId: comboPurchases.orderId,
        units: sql<number>`COALESCE(SUM(${comboPurchaseItems.quantity}), 0)`,
      })
      .from(comboPurchases)
      .innerJoin(comboPurchaseItems, eq(comboPurchaseItems.comboPurchaseId, comboPurchases.id))
      .where(
        and(
          eq(comboPurchases.paymentStatus, 'approved'),
          inArray(comboPurchases.orderId, orderIds)
        )
      )
      .groupBy(comboPurchases.orderId),
  ]);

  const rifaMap = new Map<string, number>();
  for (const r of rifaCounts as Array<{ orderId: string | null; count: number }>) {
    if (r.orderId) rifaMap.set(r.orderId, Number(r.count));
  }

  const comboMap = new Map<string, number>();
  for (const c of comboCounts as Array<{ orderId: string | null; units: number }>) {
    if (c.orderId) comboMap.set(c.orderId, Number(c.units));
  }

  return orderRows.map((r: {
    orderId: string;
    buyerName: string;
    studentName: string | null;
    course: string | null;
    division: string | null;
  }) => ({
    orderId: r.orderId,
    buyerName: r.buyerName,
    studentName: r.studentName,
    course: r.course,
    division: r.division,
    numCount: rifaMap.get(r.orderId) ?? 0,
    comboUnitsCount: comboMap.get(r.orderId) ?? 0,
  }));
}
