import fs from 'fs';
import { NextResponse } from 'next/server';
import { getAttachment, getAttachmentAbsolutePath } from '@/server/services/attachments';

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteProps) {
  const { id } = await params;
  const attachment = getAttachment(id);

  if (!attachment || attachment.archivedAt) {
    return new NextResponse('Attachment not found', { status: 404 });
  }

  const absolutePath = getAttachmentAbsolutePath(attachment);
  if (!fs.existsSync(absolutePath)) {
    return new NextResponse('Attachment file is missing from storage', { status: 404 });
  }

  const download = new URL(request.url).searchParams.get('download') === '1';
  const fileBuffer = fs.readFileSync(absolutePath);

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': attachment.mimeType || 'application/octet-stream',
      'Content-Length': String(fileBuffer.length),
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${encodeURIComponent(attachment.originalName)}"`,
      'Cache-Control': 'private, max-age=60',
    },
  });
}
