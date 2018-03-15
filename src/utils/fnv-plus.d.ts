// Type definitions for fnv-plus 0.0
// Project: https://www.npmjs.com/package/fnv-plus
// Definitions by: Rui Campos <https://github.com/catdawg>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

declare module "fnv-plus" {
        
    /** Returned by hash method*/
    export type FnvHash = {
        /** Returns the hashed value as an ascii string */
        str: () => string,
        /** Returns the hashed value as a hexadecimal string */
        hex: () => string,
        /** Returns the hashed value as a decimal string */
        dec: () => string
    }

    /**
     * Hash a string using the given bit length (52 is default)
     * @param str 
     * @param bitlength 
     * @returns {FnvHash}
     */
    export function hash(str: string, bitlength: number): FnvHash;

    /**
     * Seed the algorithm to produce different values. 
     * Hashing the same value with different seeds will very likely 
     * result in different results. To the extent your seed can be random, 
     * it can serve as a source of randomness, but nonetheless is not a 
     * replacement for a crypgographic PRG (pseudo-random generator).
     * default seed is chongo <Landon Curt Noll> /\>./\\
     * @param str 
     */
    export function seed(str: string): void;

    /**
     * Controls UTF-8 awareness of hash functions
     * default is false
     * @param bool 
     */
    export function useUTF8(bool: boolean): void;

    /**
     * Calculate FNV-1a 32bit hash
     * @param str 
     */
    export function fast1a32(str: string): number;

    /**
     * Calculate FNV-1a 32bit hash
     * @param str 
     */
    export function fast1a32hex(str: string): string;

    /**
     * Calculate FNV-1a 52bit hash
     * @param str 
     */
    export function fast1a52(str: string): number;

    /**
     * Calculate FNV-1a 52bit hash
     * @param str 
     */
    export function fast1a52hex(str: string): string;

    /**
     * Calculate FNV-1a 64bit hash
     * @param str 
     */
    export function fast1a64(str: string): number;

    /**
     * Calculate FNV-1a 32bit hash, handles UTF-8 strings
     * @param str 
     */
    export function fast1a32utf(str: string): number;

    /**
     * Calculate FNV-1a 32bit hash, handles UTF-8 strings
     * @param str 
     */
    export function fast1a32hexutf(str: string): string;

    /**
     * Calculate FNV-1a 52bit hash, handles UTF-8 strings
     * @param str 
     */
    export function fast1a52utf(str: string): number;

    /**
     * Calculate FNV-1a 52bit hash, handles UTF-8 strings
     * @param str 
     */
    export function fast1a52hexutf(str: string): string;

    /**
     * Calculate FNV-1a 64bit hash, handles UTF-8 strings
     * @param str 
     */
    export function fast1a64utf(str: string): string;

}
