import { IsString, MaxLength, MinLength } from 'class-validator';

export class ConfirmBankTransferDto {
  // Reference copied from a real bank incoming-transaction record by staff.
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  bankReference: string;
}
