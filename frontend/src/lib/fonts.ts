import localFont from "next/font/local";

export const persianSans = localFont({
  src: [
    {
      path: "../../public/fonts/iranyekan/woff2/IRANYekanX-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/iranyekan/woff2/IRANYekanX-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/iranyekan/woff2/IRANYekanX-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-persian",
  display: "swap",
});
