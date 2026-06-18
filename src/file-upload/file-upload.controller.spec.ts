import { Test, TestingModule } from '@nestjs/testing';
import { FileUploadController } from './file-upload.controller';
import { FileUploadService } from './file-upload.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';

describe('FileUploadController', () => {
  let controller: FileUploadController;

  const mockFileService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  const mockJwtGuard = {
    canActivate: (context: ExecutionContext) => true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileUploadController],
      providers: [
        {
          provide: FileUploadService,
          useValue: mockFileService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtGuard)
      .compile();

    controller = module.get<FileUploadController>(FileUploadController);

    jest.clearAllMocks();
  });

  it('should upload file successfully', async () => {
    const file = {
      originalname: 'test.png',
      mimetype: 'image/png',
      size: 100,
    } as Express.Multer.File;

    const dto = {
      folder: 'avatars',
      description: 'profile pic',
    };

    const user = { id: 'user-1' };

    const expectedResult = {
      id: 'file-1',
      url: 'http://cloudinary.com/test.png',
    };

    mockFileService.uploadFile.mockResolvedValue(expectedResult);

    const result = await controller.uploadFile(file, dto as any, user);

    expect(mockFileService.uploadFile).toHaveBeenCalledWith(file, dto, user.id);

    expect(result).toEqual(expectedResult);
  });

  it('should throw error when upload fails', async () => {
    const file = {} as Express.Multer.File;

    const dto = { folder: 'avatars' };
    const user = { id: 'user-1' };

    mockFileService.uploadFile.mockRejectedValue(new Error('Upload failed'));

    await expect(controller.uploadFile(file, dto as any, user)).rejects.toThrow(
      'Upload failed',
    );
  });

  it('should delete file successfully', async () => {
    const user = { id: 'user-1', role: 'ADMIN' };

    mockFileService.deleteFile.mockResolvedValue({
      success: true,
    });

    const result = await controller.deleteFile('file-1', user);

    expect(mockFileService.deleteFile).toHaveBeenCalledWith('file-1', user);

    expect(result).toEqual({ success: true });
  });

  it('should throw error when delete fails', async () => {
    const user = { id: 'user-1', role: 'USER' };

    mockFileService.deleteFile.mockRejectedValue(new Error('File not found'));

    await expect(controller.deleteFile('file-1', user)).rejects.toThrow(
      'File not found',
    );
  });
});
