const fetch = require ('node-fetch');

function errorMsg (error) {
    if (error) {
        const { status = '', message = 'no details' } = error;
        return `Error: ${status}: ${message}`;
    }
    return 'An unknown error!'
}

function throwExceptionOnError (data) {
    if (data.error) {
        throw new Error(errorMsg(data.error));
    }
}

const headers = {
    'Accept': 'application/json',
    'Authorization': ''
};

const client_credentials = require('./client_credentials');

let awaitingAuthorization;

// const spotifyProxy = async ()  => {
const spotifyProxy = () => {
    if (awaitingAuthorization && !client_credentials.isExpired()) {
        // use existing promise, if not expired
        return awaitingAuthorization;
    }
    if (!awaitingAuthorization || client_credentials.isExpired()) {
        awaitingAuthorization = new Promise((resolve, reject) => {
            client_credentials.authenticate()
                .then((token) => {
                    headers.Authorization = 'Bearer ' + token.access_token;
                    resolve(headers);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    }
    return awaitingAuthorization;
};

const haveHeadersWithAuthToken = async () => {
    return await spotifyProxy()
};


module.exports.fetchArtistsByName = async (name) => {
    console.log(`debug: query artist ${name} `);

    const response = await fetch(`https://api.spotify.com/v1/search?q=${name}&type=artist`, {
        headers: await haveHeadersWithAuthToken()
    });
    const data = await response.json();
    throwExceptionOnError(data);

    return (data.artists.items || [])
        .map(artistRaw => spotifyJsonToArtist(artistRaw));
};

const fetchAlbumsOfArtist = async (artistId, limit) => {
    console.log(`debug: query albums of artist ${artistId} `);

    const response = await fetch(`https://api.spotify.com/v1/artists/${artistId}/albums`, {
        headers: await haveHeadersWithAuthToken()
    });
    const data = await response.json();
    throwExceptionOnError(data);
    return (data.items || [])
        .map(albumRaw => spotifyJsonToAlbum(albumRaw));
};

const fetchTracksOfAlbum = async(albumId, limit) => {
    console.log(`debug: query tracks of album ${albumId} `);

    const response = await fetch(`https://api.spotify.com/v1/albums/${albumId}/tracks`, {
        headers: await haveHeadersWithAuthToken()
    });
    const data = await response.json();
    throwExceptionOnError(data);
    return (data.items || [])
        .map(trackRaw => spotifyJsonToTracks(trackRaw));
}

module.exports.fetchAlbumsOfArtist = fetchAlbumsOfArtist;
module.exports.fetchTracksOfAlbum = fetchTracksOfAlbum;

const spotifyJsonToArtist = async (raw) => {
    return {
        // fills with raw data (by ES6 spread operator):
        ...raw,

        // This needs extra logic: defaults to an empty string, if there is no image
        // else: just takes URL of the first image
        image: raw.images[0] ? raw.images[0].url : '',

        // .. needs to fetch the artist's albums:
        albums: (args, object) => {
            // this is similar to fetchArtistsByName()
            // returns a Promise which gets resolved asynchronously !
            const artistId = raw.id;
            const { limit=1 } = args;
            return fetchAlbumsOfArtist(artistId, limit);
        }
    };
};

const spotifyJsonToAlbum = (albumRaw) => {
    return {
        // fills with raw data (by ES6 spread operator):
        ...albumRaw,

        // This needs extra logic: defaults to an empty string, if there is no image
        // else: just takes URL of the first image
        image: albumRaw.images[0] ? albumRaw.images[0].url : '',
        tracks: fetchTracksOfAlbum(albumRaw.id)
    };
};

const spotifyJsonToTracks = (trackRaw) => {
    return {
        ...trackRaw
    }
}
