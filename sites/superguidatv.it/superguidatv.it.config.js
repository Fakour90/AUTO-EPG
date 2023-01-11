const cheerio = require('cheerio')
const axios = require('axios')
const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
const customParseFormat = require('dayjs/plugin/customParseFormat')

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(customParseFormat)

module.exports = {
  site: 'superguidatv.it',
  days: 3,
  url({ channel, date }) {
    let diff = date.diff(dayjs.utc().startOf('d'), 'd')
    let day = {
      0: 'oggi',
      1: 'domani',
      2: 'dopodomani'
    }

    return `https://www.superguidatv.it/programmazione-canale/${day[diff]}/guida-programmi-tv-${channel.site_id}/`
  },
  parser({ content, date }) {
    const programs = []
    const items = parseItems(content)
    items.forEach(item => {
      const $item = cheerio.load(item)
      const prev = programs[programs.length - 1]
      let start = parseStart($item, date)
      if (prev) {
        if (start.isBefore(prev.start)) {
          start = start.add(1, 'd')
          date = date.add(1, 'd')
        }
        prev.stop = start
      }
      const stop = start.add(30, 'm')
      programs.push({
        title: parseTitle($item),
        category: parseCategory($item),
        start,
        stop
      })
    })

    return programs
  },
  async channels() {
    const providers = [
      '',
      'premium/',
      'sky-intrattenimento/',
      'sky-sport/',
      'sky-cinema/',
      'sky-doc-e-lifestyle/',
      'sky-news/',
      'sky-bambini/',
      'sky-musica/',
      'sky-primafila/',
      'dazn/',
      'rsi/'
    ]
    const promises = providers.map(p => axios.get(`https://www.superguidatv.it/canali/${p}`))

    const channels = []
    await Promise.all(promises)
      .then(responses => {
        responses.forEach(r => {
          const $ = cheerio.load(r.data)

          $('.sgtvchannellist_mainContainer .sgtvchannel_divCell a').each((i, link) => {
            let [_, site_id] = $(link)
              .attr('href')
              .match(/guida-programmi-tv-(.*)\/$/) || [null, null]
            let name = $(link).find('.pchannel').text().trim()

            channels.push({
              lang: 'it',
              site_id,
              name
            })
          })
        })
      })
      .catch(console.log)

    return channels
  }
}

function parseStart($item, date) {
  const hours = $item('.sgtvchannelplan_hoursCell')
    .clone()
    .children('.sgtvOnairSpan')
    .remove()
    .end()
    .text()
    .trim()

  return dayjs.tz(`${date.format('YYYY-MM-DD')} ${hours}`, `YYYY-MM-DD HH:mm`, 'Europe/Rome')
}

function parseTitle($item) {
  return $item('.sgtvchannelplan_spanInfoNextSteps').text().trim()
}

function parseCategory($item) {
  const eventType = $item('.sgtvchannelplan_spanEventType').text().trim()
  const [_, category] = eventType.match(/(^[^\(]+)/) || [null, '']

  return category.trim()
}

function parseItems(content) {
  const $ = cheerio.load(content)

  return $('.sgtvchannelplan_divContainer > .sgtvchannelplan_divTableRow')
    .has('#containerInfoEvent')
    .toArray()
}
