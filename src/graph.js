'use strict'

global.SimpleRDF = (typeof ld !== 'undefined') ? ld.SimpleRDF : undefined

const Config = require('./config')
const doc = require('./doc')

module.exports = {
  getGraph,
  getGraphFromData,
  getMatchFromData,
  serializeData,
  serializeGraph,
  applyParserFixes
}

function getGraph (url) {
  return SimpleRDF(Config.Vocab, url, null, ld.store).get()
}

function getGraphFromData (data, options = {}) {
  if (!('contentType' in options)) {
    options['contentType'] = 'text/turtle'
  }
  if (!('subjectURI' in options)) {
    options['subjectURI'] = '_:dokieli'
  }

  return SimpleRDF.parse(data, options['contentType'], options['subjectURI'])
}

function getMatchFromData (data, spo = {}, options = {}) {
  if (!data) { return Promise.resolve({}) }

  spo['subject'] = spo.subject || window.location.origin + window.location.pathname
  spo['predicate'] = spo.predicate || Config.Vocab['rdfslabel']

  options['contentType'] = options.contentType || 'text/html'
  options['subjectURI'] = options.subjectURI || spo.subject

  return getGraphFromData(data, options)
    .then(g => {
      let s = SimpleRDF(Config.Vocab, spo.subject, g, ld.store).child(spo.subject)

      return s[spo.predicate]
    })
    .catch(() => {
      return undefined
    })
}

/**
 * @param data
 * @param fromContentType
 * @param toContentType
 * @param options
 *
 * @returns {Promise}
 */
function serializeData (data, fromContentType, toContentType, options) {
  if (fromContentType === toContentType) {
    return Promise.resolve(data)
  }

  options.contentType = fromContentType


  if (fromContentType == 'text/html' || fromContentType == 'application/xhtml+xml') {
    data = doc.setHTMLBase(data, options.subjectURI)
  }

// console.log(data)

  return getGraphFromData(data, options)
    .then(g => {

      options.contentType = toContentType

      switch (toContentType) {
        case 'application/ld+json':
// console.log(g)
          return serializeGraph(g, options).then(subjectTriples => {
            if (fromContentType == 'text/html' || fromContentType == 'application/xhtml+xml') {
              subjectTriples = applyParserFixes(subjectTriples, fromContentType, toContentType)
            }

            subjectTriples = JSON.parse(subjectTriples)

            var data = {}
            if (options["@context"]) {
              data["@context"] = options["@context"]
            }

            var subjectsChecked = []
            var subjectsList = []
            var rootIndex = 0

            for(var i = 0; i < subjectTriples.length; i++) {
              subjectsList.push(subjectTriples[i]["@id"])

              if ("@id" in subjectTriples[i] && subjectTriples[i]["@id"] == options.subjectURI) {
                Object.assign(data, subjectTriples[i])

                subjectsChecked.push(options.subjectURI)

                rootIndex = i
              }
            }

            var processObject = function(subject) {
              var properties = Object.keys(subject)
              properties.forEach(property => {
                if (typeof subject[property] === 'object') {
                  if ("@id" in subject[property]
                    && subjectsChecked.indexOf(subject[property]["@id"]) < 0
                    && subjectsList.indexOf(subject[property]["@id"]) > -1) {

                    subjectTriples.forEach(o => {
                      if (o["@id"] == subject[property]["@id"]) {
                        subject[property] = o;

                        subjectsChecked.push(subject[property]["@id"])
                      }
                    })
                  }

                  return Object.assign({}, processObject(subject[property]))
                }
              })

              return subject
            }

            var subject = subjectTriples[rootIndex]

            Object.assign(data, processObject(subject))

// console.log(data)
// console.log(JSON.stringify(data))
            return JSON.stringify(data) + '\n'
          })

        default:
          return serializeGraph(g, options).then(data => {
            if (fromContentType == 'text/html' || fromContentType == 'application/xhtml+xml') {
              data = applyParserFixes(data, fromContentType, toContentType)
            }

            return data
          })
      }     
    })
    .then(data => {
      //FIXME: Lazy person's JSON-LD compacting. Expect errors!
      if (options["@context"]) {
        var context = (typeof options["@context"] === 'string') ? [options["@context"]] : options['@context']

        data = JSON.parse(data);
        delete data["@context"]
        data = JSON.stringify(data)

        context.forEach(function(c){
          var search = '';
          var replace = '';

          if (typeof c === 'string') {
            switch(c) {
              case 'http://www.w3.org/ns/anno.jsonld':
                data = data.replace(new RegExp('http://www.w3.org/ns/oa#autoDirection', 'g'), 'auto')
                data = data.replace(new RegExp('http://www.w3.org/ns/oa#cachedSource', 'g'), 'cached')
                data = data.replace(new RegExp('http://www.w3.org/ns/oa#hasBody', 'g'), 'body')
                data = data.replace(new RegExp('http://www.w3.org/ns/oa#hasEndSelector', 'g'), 'endSelector')
                data = data.replace(new RegExp('http://www.w3.org/ns/oa#hasPurpose', 'g'), 'purpose')
                data = data.replace(new RegExp('http://www.w3.org/ns/oa#hasScope', 'g'), 'scope')
                data = data.replace(new RegExp('http://www.w3.org/ns/oa#hasSelector', 'g'), 'selector')
                data = data.replace(new RegExp('http://www.w3.org/ns/oa#hasSource', 'g'), 'source')
                data = data.replace(new RegExp('http://www.w3.org/ns/oa#hasStartSelector', 'g'), 'startSelector')
                data = data.replace(new RegExp('http://www.w3.org/ns/oa#hasTarget', 'g'), 'target')
                data = data.replace(new RegExp('http://www.w3.org/ns/oa#ltrDirection', 'g'), 'ltr')
                data = data.replace(new RegExp('http://www.w3.org/ns/oa#motivatedBy', 'g'), 'motivation')
                data = data.replace(new RegExp('http://www.w3.org/ns/oa#rtlDirection', 'g'), 'rtl')
                data = data.replace(new RegExp('http://www.w3.org/ns/oa#styledBy', 'g'), 'stylesheet')

                search = 'http://www.w3.org/ns/oa#'

                break

              case 'https://www.w3.org/ns/activitystreams':
                search = 'https://www.w3.org/ns/activitystreams#'
                break
            }
          }
          else {
            replace = Object.keys(c)[0];

            switch(replace) {
              case 'oa':
                search = 'http://www.w3.org/ns/oa#'
                break

              case 'as':
                search = 'https://www.w3.org/ns/activitystreams#'
                break
            }

            replace = replace + ':'
          }

          data = data.replace(new RegExp(search, 'g'), replace)
        })

        data = JSON.parse(data)
        data = Object.assign({"@context": options["@context"]}, data)
        data = JSON.stringify(data)
      }

// console.log(data)
      return data
    })
}

function serializeGraph (g, options = {}) {
  if (!('contentType' in options)) {
    options['contentType'] = 'text/turtle'
  }

  return ld.store.serializers[options.contentType].serialize(g._graph)
    // XXX: .compact doesn't work as advertised
    // .then((data) => {
    //   if (options.contentType === 'application/ld+json' && '@context' in options) {
    //     return jsonld.promises().compact(data, options['@context'], {'skipExpansion': true})
    //   }

    //   return data
    // })
}

function applyParserFixes(data, fromContentType, toContentType) {
  switch(toContentType) {
    case 'text/turtle':
      //XXX: Workaround for rdf-parser-rdfa bug that gives '@langauge' instead of @type when encountering datatype in HTML+RDFa . TODO: Link to bug here
      data = data.replace(/Z"@en;/, 'Z"^^<http://www.w3.org/2001/XMLSchema#dateTime>;');
      break;

    case 'application/ld+json':
      var x = JSON.parse(data);

      //XXX: Workaround for rdf-parser-rdfa bug that gives '@language' instead of @type when encountering datatype in HTML+RDFa . See also https://github.com/rdf-ext/rdf-parser-rdfa/issues/5
      var properties = ['https://www.w3.org/ns/activitystreams#published', 'https://www.w3.org/ns/activitystreams#updated', 'http://schema.org/dateCreated', 'http://schema.org/datePublished', 'http://schema.org/dateModified']

      for(var i = 0; i < x.length; i++){
        for(var j = 0; j < properties.length; j++){
          if(properties[j] in x[i]) {
            x[i][properties[j]] = {
              '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
              '@value': x[i][properties[j]]['@value']
            };
          }
        }
      }

      data = JSON.stringify(x);
      break;
  }        

  return data;
}
