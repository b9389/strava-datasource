export default class StravaApi {
  datasourceId: number;
  apiUrl: string;
  promises: any;

  constructor(datasourceId: number, private backendSrv: any) {
    this.datasourceId = datasourceId;
    // this.apiUrl = url;
    this.promises = {};
  }

  async getAuthenticatedAthlete(params?: any) {
    // return await this.request('athlete', params);
    return await this.tsdbRequest('athlete', params);
  }

  async getActivities(params?: any) {
    return await this.requestWithPagination('athlete/activities', params);
  }

  async requestWithPagination(url: string, params?: any) {
    let data = [];
    let chunk = [];
    let page = 1;
    const limit = params && params.limit;
    const per_page = params && params.per_page || 200;
    while (!(chunk.length === 0 && page !== 1) && !(limit && data.length >= limit)) {
      params = {
        ...params,
        per_page,
        page,
      };
      try {
        // chunk = await this.request(url, params);
        chunk = await this.tsdbRequest(url, params);
      } catch (error) {
        throw error;
      }
      data = data.concat(chunk);
      page++;
    }
    return data;
  }

  async request(url: string, params?: any) {
    return this.proxyfy(this._request, '_request', this)(url, params);
  }

  async _request(url: string, params?: any) {
    try {
      const response = await this.backendSrv.datasourceRequest({
        // url: `${this.apiUrl}/strava/${url}`,
        url: '/api/tsdb/query',
        // method: 'GET',
        method: 'POST',
        params,
      });
      return response.data;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async tsdbRequest(endpoint: string, params?: any) {
    return this.proxyfy(this._tsdbRequest, '_tsdbRequest', this)(endpoint, params);
  }

  async _tsdbRequest(endpoint: string, params?: any) {
    try {
      const tsdbRequestData = {
        queries: [{
          datasourceId: this.datasourceId,
          queryType: 'stravaAPI',
          target: {
            method: endpoint,
            params,
          },
        }],
      };

      const response = await this.backendSrv.datasourceRequest({
        url: '/api/tsdb/query',
        method: 'POST',
        data: tsdbRequestData
      });
      console.log(response);
      return this.handleTsdbResponse(response);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  handleTsdbResponse(response) {
    if (!response || !response.data || !response.data.results) {
      return [];
    }

    return response.data.results['stravaAPI'].meta;
  }

  proxyfy(func, funcName, funcScope) {
    if (!this.promises[funcName]) {
      this.promises[funcName] = {};
    }
    const promiseKeeper = this.promises[funcName];
    return callOnce(func, promiseKeeper, funcScope);
  }
}

/**
 * Wrap request to prevent multiple calls
 * with same params when waiting for result.
 */
function callOnce(func, promiseKeeper, funcScope): (...args: any[]) => any {
  return function() {
    var hash = getRequestHash(arguments);
    if (!promiseKeeper[hash]) {
      promiseKeeper[hash] = Promise.resolve(
        func.apply(funcScope, arguments)
        .then(result => {
          promiseKeeper[hash] = null;
          return result;
        })
      );
    }
    return promiseKeeper[hash];
  };
}

function getRequestHash(args) {
  const argsJson = JSON.stringify(args);
  return getHash(argsJson);
}

function getHash(srt: string) {
  var hash = 0, i, chr, len;
  if (srt.length !== 0) {
    for (i = 0, len = srt.length; i < len; i++) {
      chr   = srt.charCodeAt(i);
      hash  = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
  }
  return hash;
}
