import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth/config";
import { downloadFile } from "@/server/services/s3";
import prisma from "@/server/db/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = req.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "key parameter required" }, { status: 400 });
  }

  // Verify the file belongs to the user's organization
  const user = session.user as any;
  const file = await prisma.fileAttachment.findFirst({
    where: { s3Key: key, organizationId: user.organizationId },
  });

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    const result = await downloadFile(key);
    return new NextResponse(result.body, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.fileName)}"`,
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
