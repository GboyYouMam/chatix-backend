import {Controller, Get, Post, Body, UseGuards, UseInterceptors, UploadedFile, Param} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequestUser } from '../auth/dto/request-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
    constructor(
        private readonly usersService: UsersService,
        private readonly storageService: StorageService
    ) {}

    @Get('me')
    async getProfile(@CurrentUser() user: RequestUser) {
        return this.usersService.getUserProfile(user.userId);
    }

    @Get('profile/:username')
    async getUserByUsername(@Param('username') username: string) {
        return this.usersService.findByUsername(username);
    }

    @Post('update')
    @UseInterceptors(FileInterceptor('file'))
    async updateProfile(
        @Body() body: UpdateProfileDto,
        @CurrentUser() user: RequestUser,
        @UploadedFile() file?: Express.Multer.File
    ) {
        const updatePayload: any = { ...body };
        if (file) {
            const fileData = await this.storageService.uploadFile(file, user.userId);
            updatePayload.pfp_url = fileData.url;
        }

        const updatedUser = await this.usersService.updateProfile(user.userId, updatePayload);

        return {
            message: 'Chud successfully ascended and changed profile',
            user: updatedUser
        };
    }

    @Post('farm-aura')
    async farmAura(@CurrentUser() user: RequestUser) {
        return this.usersService.auraFarming(user.userId);
    }
}