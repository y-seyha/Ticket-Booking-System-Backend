import { Test, TestingModule } from "@nestjs/testing";
import { FileUploadService } from "./file-upload.service";
import { PrismaService } from "../prisma/prisma.service";
import { CloudinaryService } from "./cloudinary/cloudinary.service";
import { Logger } from "@nestjs/common";
import {UploadFolder} from "./dto/upload-file.dto";

describe("FileUploadService", () => {
  let service: FileUploadService;

  const mockCloudinaryService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  const mockPrismaService = {
    file: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileUploadService,
        { provide: CloudinaryService, useValue: mockCloudinaryService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<FileUploadService>(FileUploadService);

    jest.clearAllMocks();

    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
  });

  it("should upload file successfully", async () => {
    const file = {
      originalname: "test.png",
      mimetype: "image/png",
      size: 100,
    } as Express.Multer.File;

    const dto = {
      folder: UploadFolder.AVATARS,
      description: "profile",
    };

    mockCloudinaryService.uploadFile.mockResolvedValue({
      secure_url: "http://cloudinary.com/test.png",
      public_id: "abc123",
    });

    mockPrismaService.file.create.mockResolvedValue({
      id: "file-id",
    });

    const result = await service.uploadFile(file, dto, "user-1");

    expect(result.id).toBe("file-id");
    expect(mockCloudinaryService.uploadFile).toHaveBeenCalled();
    expect(mockPrismaService.file.create).toHaveBeenCalled();
  });

  it("should throw error when cloudinary upload fails", async () => {
    const file = {
      originalname: "test.png",
      mimetype: "image/png",
      size: 100,
    } as Express.Multer.File;

    const dto = {
      folder: UploadFolder.AVATARS,
      description: "profile",
    };

    mockCloudinaryService.uploadFile.mockRejectedValue(
        new Error("Cloudinary failed"),
    );

    await expect(service.uploadFile(file, dto, "user-1")).rejects.toThrow(
        "Cloudinary failed",
    );
  });

  it("should throw error when prisma create fails", async () => {
    const file = {
      originalname: "test.png",
      mimetype: "image/png",
      size: 100,
    } as Express.Multer.File;

    const dto = {
      folder: UploadFolder.AVATARS,
      description: "profile",
    };

    mockCloudinaryService.uploadFile.mockResolvedValue({
      secure_url: "url",
      public_id: "id",
    });

    mockPrismaService.file.create.mockRejectedValue(
        new Error("DB failed"),
    );

    await expect(service.uploadFile(file, dto, "user-1")).rejects.toThrow(
        "DB failed",
    );
  });

  it("should delete file if owner", async () => {
    mockPrismaService.file.findUnique.mockResolvedValue({
      id: "file-1",
      uploaderId: "user-1",
      publicId: "cloud-1",
    });

    mockCloudinaryService.deleteFile.mockResolvedValue({});

    mockPrismaService.file.delete.mockResolvedValue({});

    const result = await service.deleteFile("file-1", {
      id: "user-1",
      role: "USER",
    });

    expect(result.success).toBe(true);
  });

  it("should delete file if admin", async () => {
    mockPrismaService.file.findUnique.mockResolvedValue({
      id: "file-1",
      uploaderId: "user-2",
      publicId: "cloud-1",
    });

    mockCloudinaryService.deleteFile.mockResolvedValue({});
    mockPrismaService.file.delete.mockResolvedValue({});

    const result = await service.deleteFile("file-1", {
      id: "admin-1",
      role: "ADMIN",
    });

    expect(result.success).toBe(true);
  });

  it("should throw NotFoundException when file not found", async () => {
    mockPrismaService.file.findUnique.mockResolvedValue(null);

    await expect(
        service.deleteFile("missing", {
          id: "user-1",
          role: "USER",
        }),
    ).rejects.toThrow("File not found");
  });

  it("should throw ForbiddenException when not owner or admin", async () => {
    mockPrismaService.file.findUnique.mockResolvedValue({
      id: "file-1",
      uploaderId: "user-2",
      publicId: "cloud-1",
    });

    await expect(
        service.deleteFile("file-1", {
          id: "user-1",
          role: "USER",
        }),
    ).rejects.toThrow("You are not allowed to delete this file");
  });

  it("should throw error when cloudinary delete fails", async () => {
    mockPrismaService.file.findUnique.mockResolvedValue({
      id: "file-1",
      uploaderId: "user-1",
      publicId: "cloud-1",
    });

    mockCloudinaryService.deleteFile.mockRejectedValue(
        new Error("Cloudinary delete failed"),
    );

    await expect(
        service.deleteFile("file-1", {
          id: "user-1",
          role: "USER",
        }),
    ).rejects.toThrow("Cloudinary delete failed");
  });
});