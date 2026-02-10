declare module 'bcryptjs' {
  export type Hash = (data: string, saltOrRounds: string | number) => Promise<string>;
  export type HashSync = (data: string, saltOrRounds: string | number) => string;
  export type Compare = (data: string, encrypted: string) => Promise<boolean>;
  export type CompareSync = (data: string, encrypted: string) => boolean;
  export type GenSalt = (rounds?: number) => Promise<string>;
  export type GenSaltSync = (rounds?: number) => string;

  export interface BcryptJs {
    hash: Hash;
    hashSync: HashSync;
    compare: Compare;
    compareSync: CompareSync;
    genSalt: GenSalt;
    genSaltSync: GenSaltSync;
  }

  const bcrypt: BcryptJs;
  export default bcrypt;
}
