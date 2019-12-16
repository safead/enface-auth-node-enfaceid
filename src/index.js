const uuid = require( 'uuid' );
const constants = require( './constants' );
const utils = require( './utils' );

export class EnfaceAuth {
  constructor( {
    debug,
    httpServer,
    projectId,
    secretCode,
    fields,
    callbackUrl
  } ) {
    this._DEBUG = !!debug;
    this.projectId = projectId;
    this.secretCode = Buffer.from( secretCode, 'base64' );
    this.callbackUrl = callbackUrl;
    this.callbackUrl.endsWith( '/' )
    && ( this.callbackUrl = this.callbackUrl.substring( 0, this.callbackUrl.length - 1 ) );
    this.sessions = {};
    this.fields = fields || '';

    if ( httpServer ) {
      this.callbackUrl += constants.HTTP_URI;
      this.log( '[EnfaceAuth constructor] Using HTTP/S server' );
      httpServer
        .post( constants.HTTP_URI, ( req, res ) => {
          this.log( `[EnfaceAuth] POST REQUEST', ${req.path}, ${req.body}` );
          // add new client to clients array
          this.newClient( { client: res } );
          // send CORS headers
          utils.enfaceCors( res );
          // get POST data from the request
          if ( req.body instanceof Object ) {
            this.request( { client: res, data: JSON.stringify( req.body ) } );
          } else {
            let message = '';
            req.on( 'data', chunk => {
              message += chunk.toString();
            } );
            req.on( 'end', () => {
              // POST data ready, go to processing
              this.request( { client: res, data: message } );
            } );
          }
        } )
        .options( async ( req, res ) => {
          // just send CORS headers and finalize request
          utils.enfaceCors( res );
          res.end();
        } );
    } else {
      this.log( '[EnfaceAuth] sockets are not supported in this version' );
    }
  }

  log( value ) {
    this._DEBUG && console.log( value );
  }

  logError( value ) {
    this._DEBUG && console.error( value );
  }

  async request( { client, data } ) {
    this.log( `[EnfaceAuth.request], ${data}` );
    try {
      const { response, closeConnection } = await this.readMessage( { client, data } );
      // send response to client
      client.end( JSON.stringify( response ) );
      // remove client from clients array if needed
      closeConnection && this.finalizeSession( client );
    } catch ( error ) {
      this.logError( `[EnfaceAuth.request]', ${error.message}` );
      this.errorResponse( { client, message: error } );
      this.finalizeSession( client );
    }
  }

  readMessage( { client, data } ) {
    return new Promise( resolve => {
      this.log( `[EnfaceAuth.readMessage] data, ${JSON.stringify( data )}, client.clientId, ${client.clientId}` );
      // setting up resolver function
      this.sessions[ client.clientId ].resolver = resolve;
      try {
        data = JSON.parse( data );
      } catch ( error ) {
        this.logError( `[EnfaceAuth.readMessage], ${error.message}` );
        return this.errorResponse( { client, message: `Wrong data received ${data}` } );
      }
      switch ( data._ ) {
        // initial request from browser widget
        case constants.COMMAND_AUTH:
          return this.responseInit( { client, data } );
        // request from API server to confirm client existance
        case constants.COMMAND_CHECK:
          return this.responseCheck( { client, sessionId: data.sessionId } );
        // request from API server to confirm successfull authentication
        case constants.COMMAND_BLOCKCHAIN_AUTH:
          return this.responseBlockchainAuth( { client, data } );
        // unsupported request
        default:
          return this.errorResponse( { client, message: `Unknown command ${ data._ }` } );
      }
    } );
  }

  newClient( { client } ) {
    this.log( '[EnfaceAuth.newClient]' );
    const clientId = uuid();
    this.sessions[ clientId ] = {
      client, // link to client instance
      sessionId: uuid(), // generate new session id
      activated: false, // API server will check for the session existence once
      resolver: null // function to finalize session
    };
    client.clientId = clientId;
    // set maximum request TTL
    setTimeout( () => {
      this.finalizeSession( { clientId } );
    }, constants.AUTHORIZATION_TIME_FRAME );
  }

  switchSession( { client, clientId } ) {
    this.log( `[EnfaceAuth.switchSession] to clientId, ${clientId}` );
    // http mode requires 2 requests from client widget, so we switch second request to the original client id
    if ( !this.sessions[ clientId ] ) {
      return this.errorResponse( { client, message: `Failed to get session params for client ${clientId}` } );
    }
    this.sessions[ client.clientId ]
    && delete this.sessions[ client.clientId ].client;
    // switching the resolver function
    this.sessions[ clientId ].resolver = this.sessions[ client.clientId ].resolver;
    // terminating previous resolver
    this.finalizeSession( { clientId: client.clientId } );
    // switching to previous client id
    client.clientId = clientId;
    return true;
  }

  async responseInit( { client, data } ) {
    this.log( `[EnfaceAuth.responseInit] data, ${data}` );
    if ( data.clientId ) { // http server mode
      return this.switchSession( { client, clientId: data.clientId } );
    }
    const clientId = client.clientId;
    // response to first browser widget request
    return this.resolve( {
      client,
      data: {
        _: data._,
        token: utils.encrypt(
          [ this.sessions[ client.clientId ].sessionId, this.callbackUrl, data._ ].join( '|' ),
          this.secretCode
        ),
        id: this.projectId,
        clientId,
        fields: this.fields,
      }
    } );
  }

  responseCheck( { client, sessionId } ) {
    this.log( `[EnfaceAuth.responseCheck], sessionId, ${sessionId}` );
    // looking for client with sessionId provided
    const session = this.findSessionById( sessionId );
    if ( !session ) return this.errorResponse( { client, message: 'Client not found' } );
    if ( session.activated ) return this.errorResponse( { client, message: 'Client already activated' } );
    // set activated flag to support future actions
    session.activated = true;
    return this.resolve( {
      client,
      data: {
        _: constants.COMMAND_READY
      }
    } );
  }

  async responseBlockchainAuth( { client, data } ) {
    this.log( `[EnfaceAuth.responseBlockchainAuth] sessionId, ${data.sessionId}, ${data.alias}, ${data.fields}` );
    // looking for a client with this session id
    const session = this.findSessionById( data.sessionId );
    if ( !session ) return this.errorResponse( { client, message: 'Client not found.' } );
    // response to API server
    this.finalResponse( {
      client,
      data: {
        _: constants.COMMAND_BIO_AUTH,
        result: true
      }
    } );
    // response to browser widget
    return this.finalResponse( {
      client: session.client,
      data: {
        _: constants.COMMAND_USER_INFO,
        userInfo: { alias: data.alias, fields: data.fields }
      }
    } );
  }

  errorResponse( { client, message } ) {
    this.logError( `[EnfaceAuth.errorResponse], ${message}` );
    this.finalResponse( {
      client,
      data: {
        _: constants.COMMAND_ERROR,
        message
      }
    } );
    return false;
  }

  finalResponse( { client, data } ) {
    this.log( `[EnfaceAuth.finalResponse], ${data}` );
    this.resolve( { client, data, closeConnection: true } );
  }

  resolve( { client, data, closeConnection } ) {
    this.log( `[EnfaceAuth.resolve] client.clientId, data, ${client.clientId}, ${data}` );
    const session = this.sessions[ client.clientId ];
    if ( !session || !session.resolver ) return;
    session.resolver( { response: data, closeConnection: !!closeConnection } );
    delete session.resolver;
  }

  finalizeSession( { clientId } ) {
    this.log( `[EnfaceAuth.finalizeSession] clientId ${clientId}` );
    this.sessions[ clientId ]
    && this.closeClient( { client: this.sessions[ clientId ].client } );
    delete this.sessions[ clientId ];
  }

  closeClient( { client } ) {
    this.log( `[EnfaceAuth.closeClient] client, ${!!client}` );
    if ( !client ) return;
    try {
      client.end( 'timeout' );
    } catch ( error ) {
      this.logError( `[closeClient.error], ${error.message}` );
    }
  }

  findSessionById( sessionId ) {
    for ( const value of Object.values( this.sessions ) ) {
      if ( value.sessionId === sessionId ) return value;
    }
    return null;
  }
}
