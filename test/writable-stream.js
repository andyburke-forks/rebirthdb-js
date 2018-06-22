const path = require( 'path' )
const config = require( './config.js' )
const rebirthdb = require( path.join( __dirname, '/../lib' ) )
const assert = require( 'assert' )
const {
    uuid
} = require( path.join( __dirname, '/util/common.js' ) )
const {
    before,
    after,
    describe,
    it
} = require( 'mocha' )
const {
    Readable
} = require( 'stream' )

describe( 'writable streams', () => {
    let r, dbName, tableName, dumpTable
    const numDocs = 100

    before( async () => {
        r = await rebirthdb( config )
        dbName = uuid()
        tableName = uuid()

        dumpTable = uuid() // dump table

        let result = await r.dbCreate( dbName ).run()
        assert.equal( result.dbs_created, 1 )

        // await r.db(dbName).wait().run()
        result = await Promise.all( [
            r.db( dbName ).tableCreate( tableName )( 'tables_created' ).run(),
            r.db( dbName ).tableCreate( dumpTable )( 'tables_created' ).run()
        ] )
        assert.deepEqual( result, [ 1, 1 ] )

        result = await r.db( dbName ).table( tableName ).insert( Array( numDocs ).fill( {} ) ).run()
        assert.equal( result.inserted, numDocs )
    } )

    after( async () => {
        await r.getPool().drain()
    } )

    it( 'test pipe writable - fast input', function( done ) {
        const stream = new Readable( {
            objectMode: true
        } )
        const size = 35
        const value = uuid()
        for ( let i = 0; i < size; i++ ) {
            stream.push( {
                field: value
            } )
        }
        stream.push( null )
        const table = r.db( dbName ).table( dumpTable ).toStream( {
            writable: true,
            debug: true,
            highWaterMark: 10
        } )
        stream.pipe( table )
            .on( 'error', done )
            .on( 'finish', function() {
                r.db( dbName ).table( dumpTable ).filter( {
                    field: value
                } ).count().run().then( function( result ) {
                    assert.deepEqual( result, size )
                    assert.deepEqual( table._sequence, [ 10, 10, 10, 5 ] )
                    done()
                } )
            } )
    } )

    it( 'test pipe writable - slow input - 1', function( done ) {
        const stream = new Readable( {
            objectMode: true
        } )

        const values = [ uuid(), uuid() ]
        const table = r.db( dbName ).table( dumpTable ).toStream( {
            writable: true,
            debug: true,
            highWaterMark: 5
        } )

        let i = 0
        stream._read = function() {
            const self = this
            i++
            if ( i <= 3 ) {
                self.push( {
                    field: values[ 0 ]
                } )
            }
            else if ( i === 4 ) {
                setTimeout( function() {
                    self.push( {
                        field: values[ 1 ]
                    } )
                }, 3000 )
            }
            else if ( i <= 10 ) {
                self.push( {
                    field: values[ 1 ]
                } )
            }
            else {
                self.push( null )
            }
        }

        stream.pipe( table )
            .on( 'error', done )
            .on( 'finish', function() {
                r.expr( [
                    r.db( dbName ).table( dumpTable ).filter( {
                        field: values[ 0 ]
                    } ).count(),
                    r.db( dbName ).table( dumpTable ).filter( {
                        field: values[ 1 ]
                    } ).count()
                ] ).run().then( function( result ) {
                    assert.deepEqual( result, [ 3, 7 ] )
                    assert.deepEqual( table._sequence, [ 3, 5, 2 ] )
                    done()
                } )
            } )
    } )

    it( 'test pipe writable - slow input - 2', function( done ) {
        const stream = new Readable( {
            objectMode: true
        } )
        const values = [ uuid(), uuid() ]
        const table = r.db( dbName ).table( dumpTable ).toStream( {
            writable: true,
            debug: true,
            highWaterMark: 5
        } )

        let i = 0
        stream._read = function() {
            const self = this
            i++
            if ( i <= 5 ) {
                self.push( {
                    field: values[ 0 ]
                } )
            }
            else if ( i === 6 ) {
                setTimeout( function() {
                    self.push( {
                        field: values[ 1 ]
                    } )
                }, 3000 )
            }
            else if ( i <= 10 ) {
                self.push( {
                    field: values[ 1 ]
                } )
            }
            else {
                self.push( null )
            }
        }

        stream.pipe( table )
            .on( 'error', done )
            .on( 'finish', function() {
                r.expr( [
                    r.db( dbName ).table( dumpTable ).filter( {
                        field: values[ 0 ]
                    } ).count(),
                    r.db( dbName ).table( dumpTable ).filter( {
                        field: values[ 1 ]
                    } ).count()
                ] ).run().then( function( result ) {
                    assert.deepEqual( result, [ 5, 5 ] )
                    assert.deepEqual( table._sequence, [ 5, 5 ] )
                    done()
                } )
            } )
    } )

    it( 'test pipe writable - single insert', function( done ) {
        const stream = new Readable( {
            objectMode: true
        } )
        const value = uuid()
        const table = r.db( dbName ).table( dumpTable ).toStream( {
            writable: true,
            debug: true,
            highWaterMark: 5
        } )

        let i = 0
        stream._read = function() {
            i++
            if ( i > 10 ) {
                this.push( null )
            }
            else {
                const self = this
                setTimeout( function() {
                    self.push( {
                        field: value
                    } )
                }, 50 )
            }
        }

        stream.pipe( table )
            .on( 'error', done )
            .on( 'finish', function() {
                r.expr( r.db( dbName ).table( dumpTable ).filter( {
                    field: value
                } ).count() ).run().then( function( result ) {
                    assert.deepEqual( result, 10 )
                    assert.deepEqual( table._sequence, [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ] )
                    done()
                } )
            } )
    } )
} )