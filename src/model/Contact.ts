/** Someone to notify when the alarm is tripped. */
export class Contact {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly phone: string,
    readonly email: string,
  ) {}
}
