declare module 'istextorbinary' {
    interface IsTextOrBinary {
        isText(filename?: string | null, buffer?: Buffer | null): boolean | null;
        isBinary(filename?: string | null, buffer?: Buffer | null): boolean | null;
        getEncoding(buffer: Buffer): 'utf8' | 'binary';
    }
    
    const isTextOrBinary: IsTextOrBinary;
    export default isTextOrBinary;
}