"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { type ColumnDef, tableFeatures, useTable } from "@tanstack/react-table";
import { Button, Input, InputNumber, theme } from "antd";

import { formatMoney } from "@/shared/libs/format.lib";

export type LineItemValue = {
  key: string;
  name: string;
  unit: string;
  quantity: number | null;
  unitPrice: number | null;
};

const features = tableFeatures({});

export const amountOf = (item: Pick<LineItemValue, "quantity" | "unitPrice">) =>
  Math.round((item.quantity ?? 0) * (item.unitPrice ?? 0) * 100) / 100;

export const newLineItem = (): LineItemValue => ({
  key: crypto.randomUUID(),
  name: "",
  unit: "",
  quantity: 1,
  unitPrice: null,
});

type Props = {
  value?: LineItemValue[];
  onChange?: (value: LineItemValue[]) => void;
};

export function LineItemsTable({ value = [], onChange }: Props) {
  const { token } = theme.useToken();

  const update = (key: string, patch: Partial<LineItemValue>) =>
    onChange?.(value.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const columns: ColumnDef<typeof features, LineItemValue>[] = [
    { id: "index", header: "#", cell: ({ row }) => row.index + 1 },
    {
      id: "name",
      header: "Tên hàng hóa / chi phí",
      cell: ({ row }) => (
        <Input
          value={row.original.name}
          maxLength={200}
          status={row.original.name.trim() ? undefined : "warning"}
          onChange={(e) => update(row.original.key, { name: e.target.value })}
        />
      ),
    },
    {
      id: "unit",
      header: "ĐVT",
      cell: ({ row }) => (
        <Input
          value={row.original.unit}
          maxLength={20}
          placeholder="Cái"
          onChange={(e) => update(row.original.key, { unit: e.target.value })}
        />
      ),
    },
    {
      id: "quantity",
      header: "Số lượng",
      cell: ({ row }) => (
        <InputNumber
          className="!w-full"
          min={0.01}
          step={1}
          value={row.original.quantity}
          onChange={(quantity) => update(row.original.key, { quantity })}
        />
      ),
    },
    {
      id: "unitPrice",
      header: "Đơn giá (VNĐ)",
      cell: ({ row }) => (
        <InputNumber<number>
          className="!w-full"
          min={0}
          step={1000}
          value={row.original.unitPrice}
          formatter={(v) => (v == null ? "" : `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, "."))}
          parser={(v) => Number((v ?? "").replace(/\./g, ""))}
          onChange={(unitPrice) => update(row.original.key, { unitPrice })}
        />
      ),
    },
    {
      id: "amount",
      header: "Thành tiền",
      cell: ({ row }) => <span className="whitespace-nowrap">{formatMoney(amountOf(row.original))}</span>,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          aria-label="Xóa dòng"
          onClick={() => onChange?.(value.filter((item) => item.key !== row.original.key))}
        />
      ),
    },
  ];

  const table = useTable({
    features,
    data: value,
    columns,
    getRowId: (row) => row.key,
  });

  const total = value.reduce((sum, item) => sum + amountOf(item), 0);
  const widths: Record<string, string> = {
    index: "w-10",
    unit: "w-24",
    quantity: "w-28",
    unitPrice: "w-44",
    amount: "w-36 text-right",
    actions: "w-12",
  };

  return (
    <div>
      <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${token.colorBorderSecondary}` }}>
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead style={{ background: token.colorFillAlter }}>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id} className={`px-3 py-2 text-left font-medium ${widths[header.id] ?? ""}`}>
                    <table.FlexRender header={header} />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}>
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className={`px-2 py-1.5 ${widths[cell.column.id] ?? ""}`}>
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
            {value.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center" style={{ color: token.colorTextTertiary }}>
                  Chưa có hạng mục nào
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}>
              <td colSpan={5} className="px-3 py-2 text-right font-medium">
                Tổng cộng
              </td>
              <td className="px-3 py-2 text-right font-semibold whitespace-nowrap" style={{ color: token.colorPrimary }}>
                {formatMoney(total)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <Button className="!mt-3" icon={<PlusOutlined />} onClick={() => onChange?.([...value, newLineItem()])}>
        Thêm hạng mục
      </Button>
    </div>
  );
}
