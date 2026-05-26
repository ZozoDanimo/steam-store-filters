-- Steam Store Filters -- Lua backend for HTTP requests (bypass CORS)
local millennium = require("millennium")
local http = require("http")
local logger = require("logger")

local GG_API_KEY = "mwauuk7lS7ptVoP5J6a09rNdu2T7y5jv"
local GG_BASE = "https://api.gg.deals/v1/prices/by-steam-app-id"

-- Fetch Steam search results (bypass CORS). Returns raw JSON response.
function fetch_steam_search(url)
    local resp = http.get(url)
    if not resp or resp.status ~= 200 then
        logger:warn("Steam search fetch failed: " .. tostring(resp and resp.status or "no response"))
        return ""
    end
    return resp.body
end

-- Fetch screenshots for a Steam appid. Returns comma-separated screenshot URLs (max 4).
function fetch_screenshots(appid)
    local url = "https://store.steampowered.com/api/appdetails?appids=" .. tostring(appid) .. "&l=french&cc=FR"
    local resp = http.get(url)
    if not resp or resp.status ~= 200 then
        return ""
    end
    
    -- Parse JSON to extract screenshot URLs
    local data = resp.body
    local screenshots = {}
    
    -- Extract screenshots array from JSON
    local screenshots_start = data:find('"screenshots"%s*:%s*%[')
    if screenshots_start then
        local screenshots_end = data:find(']', screenshots_start)
        if screenshots_end then
            local screenshots_section = data:sub(screenshots_start, screenshots_end)
            
            -- Extract individual screenshot entries
            for entry in screenshots_section:gmatch('{[^}]*}') do
                -- Check if it's a video (skip videos)
                if not entry:match('"type"%s*:%s*"video"') then
                    -- Extract path_full (screenshot URL)
                    local path = entry:match('"path_full"%s*:%s*"([^"]*)"')
                    if path then
                        -- Unescape URL (Steam returns \/ instead of /)
                        path = path:gsub("\\/", "/")
                        -- Verify it's an image (not a video URL)
                        if path:match("%.jpg$") or path:match("%.png$") or path:match("%.webp$") then
                            table.insert(screenshots, path)
                            if #screenshots >= 4 then
                                break
                            end
                        end
                    end
                end
            end
        end
    end
    
    return table.concat(screenshots, ",")
end

-- Fetch gg.deals prices for Steam appids. Returns raw JSON response.
function fetch_gg_deals(appids_csv, region)
    region = region or "us"
    local url = GG_BASE .. "/?key=" .. GG_API_KEY .. "&ids=" .. appids_csv .. "&region=" .. region
    local resp = http.get(url)
    if not resp or resp.status ~= 200 then
        logger:warn("gg.deals fetch failed: " .. tostring(resp and resp.status or "no response"))
        return ""
    end
    return resp.body
end

-- Extract { total_reviews, total_positive } numbers from the appreviews JSON
-- response body using string.match (no JSON parser needed).
local function extract_review_counts(body)
    if type(body) ~= "string" then return nil, nil end
    local total_reviews  = tonumber(body:match('"total_reviews"%s*:%s*(%d+)'))
    local total_positive = tonumber(body:match('"total_positive"%s*:%s*(%d+)'))
    return total_reviews, total_positive
end

-- Batch variant: takes a comma-separated list of appids, returns a string
-- of the form "appid:total:positive;appid:total:positive;...".
-- Apps with no data (HTTP error or no reviews) are simply omitted.
function fetch_recent_reviews_batch(appids_csv)
    if type(appids_csv) ~= "string" or appids_csv == "" then
        return ""
    end

    local parts = {}
    for appid_str in string.gmatch(appids_csv, "([^,]+)") do
        local appid = tonumber(appid_str)
        if appid then
            local url = "https://store.steampowered.com/appreviews/" .. tostring(appid)
                .. "?json=1&filter=recent&language=all&purchase_type=all&num_per_page=0"
            local response = http.get(url)
            if response and response.status == 200 then
                local total, positive = extract_review_counts(response.body)
                if total and positive then
                    parts[#parts + 1] = string.format("%d:%d:%d", appid, total, positive)
                end
            end
        end
    end

    return table.concat(parts, ";")
end


function on_load()
    logger:info("steam-store-filters backend loaded")
    millennium.ready()
end

function on_unload()
end

return {
    on_load   = on_load,
    on_unload = on_unload,
    fetch_gg_deals = fetch_gg_deals,
    fetch_steam_search = fetch_steam_search,
    fetch_screenshots = fetch_screenshots,
}
