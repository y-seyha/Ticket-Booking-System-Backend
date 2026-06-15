import {
    Injectable,
    Logger,
    ForbiddenException,
    NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UploadFileDto } from "./dto/upload-file.dto";
import { CloudinaryService } from "./cloudinary/cloudinary.service";

@Injectable()
export class FileUploadService {
    private readonly logger = new Logger(FileUploadService.name);

    constructor(
        private readonly cloudinary: CloudinaryService,
        private readonly prisma: PrismaService,
    ) {}

    async uploadFile(
        file: Express.Multer.File,
        dto: UploadFileDto,
        userId?: string,
    ) {
        try {
            this.logger.log(
                `Uploading file: ${file.originalname} to folder: ${
                    dto.folder || "general"
                }`,
            );

            const result = await this.cloudinary.uploadFile(
                file,
                dto.folder || "general",
            );
            this.logger.log(`UploaderId received: ${userId}`);
            const savedFile = await this.prisma.file.create({
                data: {
                    originalName: file.originalname,
                    mimeType: file.mimetype,
                    size: file.size,
                    url: result.secure_url,
                    publicId: result.public_id,
                    uploaderId: userId ?? null,
                    description: dto.description,
                },
            });

            this.logger.log(`File saved to DB: ${savedFile.id}`);

            return savedFile;
        } catch (error) {
            this.logger.error(
                `Upload failed for file: ${file.originalname}`,
                error.stack || error,
            );
            throw error;
        }
    }

    async deleteFile(fileId: string, user: any) {
        try {
            this.logger.log(`Deleting file with ID: ${fileId}`);

            const file = await this.prisma.file.findUnique({
                where: { id: fileId },
            });

            if (!file) {
                throw new NotFoundException("File not found");
            }

            const isOwner = file.uploaderId === user.id;
            const isAdmin = user.role === "ADMIN";

            if (!isOwner && !isAdmin) {
                throw new ForbiddenException(
                    "You are not allowed to delete this file",
                );
            }

            await this.cloudinary.deleteFile(file.publicId);

            await this.prisma.file.delete({
                where: { id: fileId },
            });

            this.logger.log(`File deleted successfully: ${fileId}`);

            return { success: true };
        } catch (error) {
            this.logger.error(
                `Delete failed for file: ${fileId}`,
                error.stack || error,
            );
            throw error;
        }
    }
}