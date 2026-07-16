"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderStatusBadge } from "./status-badge";
import { formatDate, formatMoney } from "@/lib/format";

export type OrderRow = {
  id: string;
  trackingNumber: string;
  status: string;
  orderType: string;
  paymentType: string;
  totalCharge: string | number;
  currency: string;
  createdAt: string;
  pickupZone?: { name: string; code: string } | null;
  dropZone?: { name: string; code: string } | null;
  currentAgent?: { profile: { name: string } } | null;
  customer?: { name: string } | null;
};

export function OrdersTable({
  orders,
  basePath,
  showCustomer = false,
  showAgent = false,
}: {
  orders: OrderRow[];
  basePath: string;
  showCustomer?: boolean;
  showAgent?: boolean;
}) {
  if (orders.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No orders yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tracking</TableHead>
            {showCustomer && <TableHead>Customer</TableHead>}
            <TableHead>Route</TableHead>
            <TableHead>Type</TableHead>
            {showAgent && <TableHead>Agent</TableHead>}
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => (
            <TableRow key={o.id} className="cursor-pointer">
              <TableCell className="font-mono text-xs">
                <Link href={`${basePath}/${o.id}`} className="hover:underline">
                  {o.trackingNumber}
                </Link>
              </TableCell>
              {showCustomer && <TableCell>{o.customer?.name ?? "—"}</TableCell>}
              <TableCell className="text-sm">
                {o.pickupZone?.code ?? "?"} → {o.dropZone?.code ?? "?"}
              </TableCell>
              <TableCell className="text-sm">
                {o.orderType} · {o.paymentType}
              </TableCell>
              {showAgent && (
                <TableCell className="text-sm">
                  {o.currentAgent?.profile.name ?? "—"}
                </TableCell>
              )}
              <TableCell className="text-right tabular-nums">
                {formatMoney(o.totalCharge, o.currency)}
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={o.status} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(o.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
