import { Sidebar } from "@/components/common/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen glass-bg">
      <Sidebar />
      <main className="flex-1 p-4 pt-16 lg:p-6 lg:pt-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
