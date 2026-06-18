import { PartialType } from '@nestjs/swagger';
import { CreateScreenDto } from './create-screen.dto';

export class UpdateScreenDto extends PartialType(CreateScreenDto) {}
