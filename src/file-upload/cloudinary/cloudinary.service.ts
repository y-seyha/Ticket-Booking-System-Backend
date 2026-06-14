import { Inject, Injectable, Logger } from "@nestjs/common";
import { UploadApiResponse, UploadApiErrorResponse } from "cloudinary";
import * as streamifier from "streamifier";
import {UploadFolder} from "../dto/upload-file.dto";

const CLOUDINARY_ROOT = "ticket_booking_system";

@Injectable()
export class CloudinaryService {
    private readonly logger = new Logger(CloudinaryService.name);

    constructor(
        @Inject("CLOUDINARY")
        private readonly cloudinary: any,
    ) {}

    uploadFile(
        file: Express.Multer.File,
        folder: string = UploadFolder.GENERAL
    ): Promise<UploadApiResponse> {
        const fullFolder = `${CLOUDINARY_ROOT}/${folder}`;

        this.logger.log(`Uploading file to folder: ${fullFolder}`);

        return new Promise((resolve, reject) => {
            const uploadStream = this.cloudinary.uploader.upload_stream(
                {
                    folder: fullFolder,
                    resource_type: "auto",
                },
                (error: UploadApiErrorResponse, result: UploadApiResponse) => {
                    if (error) {
                        this.logger.error("Upload failed", error);
                        return reject(error);
                    }

                    this.logger.log(`Upload success: ${result?.public_id}`);
                    resolve(result);
                },
            );

            streamifier.createReadStream(file.buffer).pipe(uploadStream);
        });
    }

    async deleteFile(publicId: string): Promise<any> {
        this.logger.log(`Deleting file: ${publicId}`);
        return this.cloudinary.uploader.destroy(publicId);
    }
}