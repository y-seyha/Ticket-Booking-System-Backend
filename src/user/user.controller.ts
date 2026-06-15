import {
    Controller,
    Get,
    Patch,
    Param,
    Body,
    UseGuards,
    Query,
    Delete, UseInterceptors, UploadedFile,
} from "@nestjs/common";

import {
    ApiBearerAuth,
    ApiTags,
    ApiOperation,
    ApiParam,
    ApiQuery,
} from "@nestjs/swagger";

import { UserService } from "./user.service";
import { JwtAuthGuard } from "../authentication/guards/jwt-auth.guard";
import { CurrentUser } from "../authentication/decorators/current-user.decorator";
import { Role } from "@prisma/client";
import { RolesGuard } from "../authentication/guards/roles.guard";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import {Roles} from "../authentication/decorators/role.decorator";
import {FileInterceptor} from "@nestjs/platform-express";

@ApiTags("Users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get("me")
    @ApiOperation({ summary: "Get current user profile" })
    getMyProfile(@CurrentUser() user: any) {
        return this.userService.getMyProfile(user.id);
    }

    @Patch('me')
    @UseInterceptors(FileInterceptor('avatar'))
    updateMyProfile(
        @CurrentUser() user: any,
        @Body() dto: UpdateProfileDto,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        return this.userService.updateProfile(
            user.id,
            dto,
            file,
        );
    }

    @Delete("me")
    @ApiOperation({ summary: "Disable my account (soft delete)" })
    disableMyAccount(@CurrentUser() user: any) {
        return this.userService.disableAccount(user.id);
    }

    // ADMIN SECTION
    @Get()
    @Roles(Role.ADMIN)
    @UseGuards(RolesGuard)
    @ApiOperation({ summary: "Get all users (admin only)" })
    @ApiQuery({ name: "page", required: false })
    @ApiQuery({ name: "limit", required: false })
    getAllUsers(
        @Query("page") page = 1,
        @Query("limit") limit = 10,
    ) {
        return this.userService.getAllUsers(Number(page), Number(limit));
    }

    @Get(":id")
    @Roles(Role.ADMIN)
    @UseGuards(RolesGuard)
    @ApiOperation({ summary: "Get user by id (admin only)" })
    @ApiParam({ name: "id" })
    getUserById(@Param("id") id: string) {
        return this.userService.getUserById(id);
    }

    @Patch(":id/ban")
    @Roles(Role.ADMIN)
    @UseGuards(RolesGuard)
    @ApiOperation({ summary: "Ban user" })
    banUser(
        @Param("id") id: string,
        @CurrentUser() user: any,
    ) {
        return this.userService.banUser(id, user.id);
    }

    @Patch(":id/unban")
    @Roles(Role.ADMIN)
    @UseGuards(RolesGuard)
    @ApiOperation({ summary: "Unban user" })
    unbanUser(@Param("id") id: string) {
        return this.userService.unbanUser(id);
    }

    @Patch(":id/role")
    @Roles(Role.ADMIN)
    @UseGuards(RolesGuard)
    @ApiOperation({ summary: "Change user role" })
    changeRole(
        @Param("id") id: string,
        @Body("role") role: Role,
        @CurrentUser() user: any,
    ) {
        return this.userService.changeRole(id, role, user.id);
    }

    @Delete(":id")
    @Roles(Role.ADMIN)
    @UseGuards(RolesGuard)
    @ApiOperation({ summary: "Soft delete user" })
    deleteUser(
        @Param("id") id: string,
        @CurrentUser() user: any,
    ) {
        return this.userService.deleteUser(id, user.id);
    }
}