import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class SyncRolePermissionsDto {
    @ApiProperty({
        description: 'Array of permission IDs to assign to the role',
        example: ['uuid-1', 'uuid-2'],
        type: [String],
    })
    @IsArray()
    @IsUUID('all', { each: true })
    permissionIds: string[];
}
