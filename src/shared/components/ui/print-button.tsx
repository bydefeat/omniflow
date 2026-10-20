"use client";

import { PrinterOutlined } from "@ant-design/icons";
import { Button } from "antd";

export function PrintButton() {
  return (
    <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
      In đơn
    </Button>
  );
}
