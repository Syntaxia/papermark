import type { NextApiRequest, NextApiResponse } from "next";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerSession } from "next-auth/next";

import { getS3Client } from "@/lib/files/aws-client";
import { CustomUser } from "@/lib/types";

import { authOptions } from "../auth/[...nextauth]";

const uploadConfig = {
  profile: {
    allowedContentTypes: ["image/png", "image/jpg", "image/jpeg"],
    maximumSizeInBytes: 2 * 1024 * 1024, // 2MB
  },
  assets: {
    allowedContentTypes: [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/svg+xml",
      "image/x-icon",
      "image/ico",
    ],
    maximumSizeInBytes: 5 * 1024 * 1024, // 5MB
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).end("Method Not Allowed");
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).end("Unauthorized");
  }

  const type = Array.isArray(req.query.type)
    ? req.query.type[0]
    : req.query.type;

  if (!type || !(type in uploadConfig)) {
    return res.status(400).json({ error: "Invalid upload type specified." });
  }

  const { fileName, contentType } = req.body as {
    fileName: string;
    contentType: string;
  };

  if (!fileName || !contentType) {
    return res
      .status(400)
      .json({ error: "fileName and contentType are required" });
  }

  const config = uploadConfig[type as keyof typeof uploadConfig];
  if (!config.allowedContentTypes.includes(contentType)) {
    return res.status(400).json({ error: "Content type not allowed" });
  }

  try {
    const client = getS3Client();
    const bucket = process.env.NEXT_PRIVATE_UPLOAD_BUCKET;
    const userId = (session.user as CustomUser).id;
    const key = `_assets/${userId}/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(client, command, {
      expiresIn: 3600,
    });

    // Return the presigned URL for direct upload and the final S3 key
    return res.status(200).json({
      presignedUrl,
      key,
      bucket,
      region: process.env.NEXT_PRIVATE_UPLOAD_REGION || "us-east-1",
    });
  } catch (error) {
    console.error("Error generating presigned URL for image upload:", error);
    return res.status(500).json({ error: "Failed to prepare upload" });
  }
}
