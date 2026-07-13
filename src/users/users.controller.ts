import {
    Controller,
    Get,
    Post,
    Body,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    Param,
    UploadedFiles
} from '@nestjs/common';
import {FileFieldsInterceptor, FileInterceptor} from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequestUser } from '../auth/dto/request-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateProfileCommentDto } from './dto/create-profile-comment.dto';

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
    async getUserByUsername(
        @Param('username') username: string,
        @CurrentUser() user: RequestUser,
    ) {
        return this.usersService.findByUsername(username, user.userId);
    }

    @Get('profile/:username/comments')
    async getProfileComments(@Param('username') username: string) {
        return this.usersService.getProfileComments(username);
    }

    @Post('profile/:username/comments')
    async createProfileComment(
        @Param('username') username: string,
        @Body() body: CreateProfileCommentDto,
        @CurrentUser() user: RequestUser,
    ) {
        return this.usersService.createProfileComment(username, user.userId, body.body);
    }

    @Post('profile/:username/respect')
    async giveProfileRespect(
        @Param('username') username: string,
        @CurrentUser() user: RequestUser,
    ) {
        return this.usersService.giveProfileRespect(username, user.userId);
    }

    @Post('update')
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'file', maxCount: 1 },
        { name: 'upper_banner', maxCount: 1 },
        { name: 'left_banner', maxCount: 1 },
        { name: 'right_banner', maxCount: 1 },
    ]))
    async updateProfile(
        @Body() body: UpdateProfileDto,
        @CurrentUser() user: RequestUser,
        @UploadedFiles() files?: {
            file?: Express.Multer.File[],
            upper_banner?: Express.Multer.File[],
            left_banner?: Express.Multer.File[],
            right_banner?: Express.Multer.File[]
        }
    ) {
        const updatePayload: any = { ...body };
        const updatedUser = await this.usersService.updateProfile(user.userId, updatePayload, files);

        return {
            message: 'Chud successfully ascended and changed profile visuals',
            user: updatedUser
        };
    }

    @Post('farm-aura')
    async farmAura(@CurrentUser() user: RequestUser) {
        return this.usersService.auraFarming(user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Post('pay-debt')
    async payDebt(@CurrentUser() user: RequestUser) {
        return this.usersService.payDebt(user.userId);
    }
}
