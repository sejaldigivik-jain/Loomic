declare module "qrcode.react" {
  import * as React from "react";
  export const QRCodeSVG: React.ComponentType<{ value: string; size?: number; level?: "L" | "M" | "Q" | "H"; includeMargin?: boolean }>;
}
