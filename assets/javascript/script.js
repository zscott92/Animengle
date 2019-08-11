let matchGenerator;
apiDelay = () => new Promise(resolve => setTimeout(resolve, 550));

async function * createMatchGenerator(emotionData) {
    let currentEmotion;
    let page = 1;
    let checkNextPage = false;
    let searchResponse = [];
    let delay = apiDelay();

    const transform = {
        anger: "mecha",
        neutral: "catgirl",
        disgust: "tsundere",
        sadness: "yandere",
        fear: "yandere",
        happiness: "gyaru",
        surprise: "magical girl",
    };

    while (true) {
        await delay;
        console.log(searchResponse.length);
        if (!searchResponse.length) {
            console.log('debug');
            if (checkNextPage) {
                page ++;
                const response = await $.get("https://api.jikan.moe/v3/search/character/?" + $.param({ q: transform[currentEmotion], page: page }));
                delay = apiDelay();
                if (response.results) {
                    checkNextPage = response.results.length == 50;
                    searchResponse = response.results;
                    continue;
                } else {
                    checkNextPage = false;
                    page = 1;
                    continue;
                }
            }
            console.log('debug 2')

            page = 1;

            console.log(emotionData);
            
            // choose a new emotion
            let rand = Math.random() * 100;
            currentEmotion = (function getEmotion(emotions) {
                for (e in emotions) {
                    rand -= emotions[e];
                    if (rand <= 0) {
                        return e;
                    }
                }
            })(emotionData);
            console.log(emotionData[currentEmotion]);
            // Transform the remaining emotions to add up to 1
            const divisor = 100 - emotionData[currentEmotion];
            for (e in emotionData) {
                emotionData[e] = emotionData[e] / divisor * 100;
            }
            console.log(emotionData);
            // Remove the chosen emotion from the object
            delete emotionData[currentEmotion];

            const response = await $.get("https://api.jikan.moe/v3/search/character/?" + $.param({ q: transform[currentEmotion], page: page }));
            console.log(response);
            checkNextPage = response.results.length == 50;
            searchResponse = response.results;
            delay = apiDelay();
            continue;
        }

        // We have more characters to check
        delay = apiDelay() // first, set up a new delay timer
        const randEntry = searchResponse.splice(Math.floor(Math.random() * searchResponse.length), 1)[0];
        const charDetails = await $.get(`https://api.jikan.moe/v3/character/${randEntry.mal_id}`);
        const charProto = Object.assign(
            parseAbout(charDetails.about), {
                name: charDetails.name,
                featured: charDetails.animeography,
                image_url: charDetails.image_url
            });

        for (filter of profileFilters) {
            // Start over if the profile fails a test
            if (!filter(charProto)) continue;
        }

        yield new Profile(charProto);
    }
}

function parseAbout(about) {
    let match = about.match(
        // /^(?<stats>(?:[a-zA-z0-9- ]+:.+\r?\n?)+)(?<about>(?:.+\r?\n?)+)?/i
        /^((?:[a-zA-z0-9- ]+:.+\r?\n?)+)((?:.+\r?\n?)+)?/i
    );
    // console.log(match);
    if (match) {
        const output = {};
        const stats = match[1];
        output.stats = {
            hair: stats.match(/Hair:\s?(.*[a-zA-z]*?)/),
            eyes: stats.match(/Eyes:\s?(.*[a-zA-z]*?)/),
            clothes: stats.match(/Clothes:\s?(.*[a-zA-z]*?)/),
            personality: stats.match(/Personality:\s?(.*[a-zA-z]*?)/),
            role: stats.match(/Role:\s?(.*[a-zA-z]*?)/),
            height: stats.match(/Height:\s?(.*[a-zA-z]*?)/),
            measurements: stats.match(
                /(?:Bust-Waist-Hips|B-W-H|Three sizes):\s?(.*[a-zA-z]*?)/
            ),
            age: stats.match(/Age:\s?(.*\w*?)/),
            birthday: stats.match(/Birthday:\s?(.*[a-zA-z]*?)/),
            subjectOf: stats.match(/Subject of:\s?(.*[a-zA-z]*?)/)
        };
        Object.keys(output.stats).forEach(
            k => (output.stats[k] = output.stats[k] && output.stats[k][1])
        );

        output.about = match[2] && match[2].replace(/\(Source:.+\).*|No voice.*/i, "");
        output.raw = about;
        output.source = match[2] && match[2].match(/\(Source:.+\).*|No voice.*/i);
        output.source = output.source && output.source[0];

        return output;
    }
    // other bios
    // console.log(about);
    match = about.match(
        /((?:.+\r?\n?)+?)((?:\(Source:.+\).*|No voice.*))?/
    );
    // console.log(match);
    if (match) {
        output = {
            about: match[1],
            source: match[2],
            raw: about
        };

        let age = match[1].match(/(\d*) years? old/i);
        if (age) {
            output.stats = { age: age[1] };
        } else {
            age = match[1].match(/age:\s?(\d*)/i)
            if (age) {
                output.stats = { age: age[1] };
            }
        }

        output.about = output.about && output.about.replace(/\(Source:.+\).*|No voice.*/i, "");

        return output;
    }
}

let loadedProfiles = new Set([]);
let loading = false;

function loadMore() {
    drawLoadScreen();
    return matchGenerator.next().then(function (profile) {
        $("#loading-card").remove();
        $('#profile-space').append(profile.value.buildNode());
        loadedProfiles.add(profile.value);
        loading = false;

        // If we're scrolled to the loading screen when loading finishes, we want to immediately load another.
        const margin = parseInt($('.profile').css('margin-left').replace('px', '') * 2);
        const profileSpace = $('#profile-space')
        const width = profileSpace.width() + margin;
        const page = (profileSpace.scrollLeft() + margin / 2) / width;
        const pageCiel = Math.ceil(page);
        // console.log(page, loadedProfiles.size);
        if (pageCiel == loadedProfiles.size) {
            loadMore();
        }
    });
}

function drawLoadScreen() {
    if (!loading) {
        loading = true;
        $('#profile-space').append(
            $('<div>').addClass('profile').attr('id', 'loading-card').append(
                $('<div class="loading-filler">'),
                $('<progress class="progress is-small is-primary loading-bar" max="100">')
            )
        );
    }
}

function requestFaceData(selectImgFile) {
    let data = new FormData();
    data.append("api_key", "ck3PwAKq4ZDsnbx77dyZG3lEk_YDwCIz");
    data.append("api_secret", "Epcw27lJerS2w28JQvd2DYhG_Rs-LjFJ");
    data.append("image_file", selectImgFile);
    data.append(
        "return_attributes",
        "emotion"
    );

    console.log(data);
    return $.ajax({
        url: "https://api-us.faceplusplus.com/facepp/v3/detect",
        method: "POST",
        contentType: false,
        mimeType: "multipart/form-data",
        processData: false,
        data: data
    });
}

function drawLogo() {
    const svg = `<svg height="63" width="68.4" viewbox="0 0 342 315" transform="rotate(-135) translate(5 5)">
    <defs>
        <style type="text/css">
            <![CDATA[
                .outline {
                    stroke: none;
                    stroke-width: 0
                }

                .a {
                    font: montserrat;
                    font-size: 130pt;
                }
            ]]>
        </style>
        <filter id="f3" x="0" y="0" width="200%" height="200%">
            <feOffset result="offOut" in="SourceGraphic" dx="20" dy="20" />
            <feColorMatrix result="matrixOut" in="offOut" type="matrix"
            values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0" />
            <feGaussianBlur result="blurOut" in="matrixOut" stdDeviation="10" />
            <feBlend in="SourceGraphic" in2="blurOut" mode="normal" />
        </filter>
        <g id="heart2">
            <path d="M0 200 v-200 h200 
                    a100,100 90 0,1 0,200
                    a100,100 90 0,1 -200,0
                    z" />
            <text x="-70" y="-100" z="2" class="a" fill="white" transform="rotate(135)">ア</text>
        </g>
    </defs>
    <desc>
        a nearly perfect heart
        made of two arcs and a right angle
    </desc>
    <use xlink:href="#heart2" class="outline " fill="purple" />
</svg>`

    return $('<div class="logo-full">').append(
        $(svg),
        $('<span class="logo-text">').text('nimingle')
    )
}

let leftButtonStatus = false;
let rightButtonStatus = true;
let scrollSnapEnabled = true;

let currentPage = 0;
function setupProfileSpace() {
    $('#display-area').empty().css({ height: 'initial' }).append(
        $('<div>').addClass('scroll-button-wrapper scroll-left').append(
            $('<a>').addClass('button scroll-button is-static').attr('data-scroll', '-1').append(
                $('<i class="fas fa-angle-left">')
            )
        ),
        $('<div>').attr('id', 'profile-space'),
        $('<div>').addClass('scroll-button-wrapper scroll-right').append(
            $('<a>').addClass('button scroll-button').attr('data-scroll', '1').append(
                $('<i class="fas fa-angle-right">')
            )
        ),
    )
    $('#profile-space').scrollLeft(0);

    // bind events
    $('#profile-space').on('scroll', function (event) {
        const margin = parseInt($('.profile').css('margin-left').replace('px', '') * 2);
        const profileSpace = $('#profile-space')
        const width = profileSpace.width() + margin;
        let page = (profileSpace.scrollLeft() + margin / 2) / width;
        const pageInt = Math.floor(page);
        const pageCiel = Math.ceil(page);
        if (pageInt <= 0 && leftButtonStatus) {
            leftButtonStatus = false;
            $('.scroll-button-wrapper.scroll-left .button').addClass('is-static');
        } else if (pageInt != 0 && !leftButtonStatus) {
            leftButtonStatus = true;
            $('.scroll-button-wrapper.scroll-left .button').removeClass('is-static');
        }

        if (pageCiel == loadedProfiles.size && rightButtonStatus) {
            rightButtonStatus = false;
            $('.scroll-button-wrapper.scroll-right button').addClass('is-static');
        } else if (pageCiel != loadedProfiles.size && !rightButtonStatus) {
            rightButtonStatus = true;
            $('.scroll-button-wrapper.scroll-right button').removeClass('is-static');
        }

        if (!(page % 1) && page != currentPage) { // we have scrolled to a new page
            $(`#profile-space .profile:nth-child(${currentPage + 1})`).scrollTop(0);
            currentPage = page;
            if (page == loadedProfiles.size - 1 && !loading) {
                loadMore();
            }
        }

        if (pageCiel == loadedProfiles.size && !loading) { // We have just scrolled to the last page
            loadMore();
        }
    });
    $('.scroll-button').on('click', function (event) {
        // scrollSnapEnabled = false;
        // new Promise(resolve => setTimeout(resolve, 100)).then(
        //     () => scrollSnapEnabled = true
        // )
        const profileSpace = $('#profile-space');
        const scrollIncrement = profileSpace.width();
        profileSpace.scrollLeft(profileSpace.scrollLeft() + parseInt($(this).attr('data-scroll')) * scrollIncrement);
    });
}

$('#about-button').on('click', function () {
    $('.modal').toggleClass('is-active');
});

$('.delete').on('click', function () {
    $('.modal').toggleClass('is-active');
})

$('#splash-button').on('click', function () {
    $('input[type=file]').trigger('click');
});

$('#home-button').on('click', function () {
    location.reload();
});

$('input[type=file]').change(function (e) {
    const path = $(this).val();
    const match = path.match(/\.(png|jpg|jpeg|gif)$/);
    if (match) {
        setupProfileSpace();
        drawLoadScreen();
        $('#profile-space').scrollLeft(0);
        requestFaceData(e.target.files[0]).then(
            function (results) {
                console.log(results.face);
                matchGenerator = createMatchGenerator(JSON.parse(results).faces[0].attributes.emotion);

                loadMore().then(loadMore);
            }
        );
    }
});

$(document).ready(function () {
    $('#splashTitle').empty().append(drawLogo());
});
