import { DailyAdminPage } from "@/components/daily-admin-page";

export const metadata = {
  title: "AI 日报后台",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminDailyRoutePage() {
  return <DailyAdminPage />;
}
