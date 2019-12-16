const crypto = require( 'crypto' );
const constants = require( './constants' );

exports.encrypt = function ( text, key ) {
  const iv = crypto.randomBytes( 16 );
  const cipher = crypto.createCipheriv( constants.AES_CIPHER, Buffer.from( key ), iv );
  let encrypted = cipher.update( text );
  encrypted = Buffer.concat( [ encrypted, cipher.final() ] );
  return `${iv.toString( 'hex' )}${encrypted.toString( 'hex' )}`;
};

exports.decrypt = function ( data, key ) {
  const iv = Buffer.from( data.substr( 0, 32 ), 'hex' );
  const encryptedText = Buffer.from( data.substr( 32 ), 'hex' );
  const decipher = crypto.createDecipheriv( constants.AES_CIPHER, Buffer.from( key ), iv );
  let decrypted = decipher.update( encryptedText );
  decrypted = Buffer.concat( [ decrypted, decipher.final() ] );
  return decrypted.toString();
};

exports.isUuid = function ( string ) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test( string );
};

exports.enfaceCors = function ( res ) {
  res.header( {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range'
  } );
};
