<template>
    <div class="search-bar">
        <div class="search">
            <div class="search__pre">
                <img 
                    class="search__pre-image"
                    src="../../Assets/img/ayim-mca/site/magnifying glass.png"
                >
            </div>
            <input
                class="search__input"
                :placeholder="placeholder"
                maxlength="50"
                @input="updateText($event)"
            >
        </div>

        <slot />
    </div>    
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import _ from "lodash";

@Component
export default class SearchBar extends Vue {

    @Prop({ type: String, required: true }) readonly placeholder!: string;

    updateText (e) {
        this.debounce(e.target.value);
    }
    
    // Vue doesnt allow using debounce inside methods, so no idea how this stuff below works, but works Ok
    mounted () {
        this.emitUpdate = _.debounce(this.emitUpdate, 500);
    }

    debounce (text){
        this.emitUpdate(text);
    }

    emitUpdate (text) {
        this.$emit("update:search", text);
    }

}
</script>

<style lang="scss">
@import '@s-sass/_variables';
@import '@s-sass/_mixins';

.search-bar {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    width: 100%;
}

.search {
    display: flex;
    flex: 1;
    min-width: 200px;

    & > *, & ~ * {
        padding: 5px;
        margin: 5px;
    }
}

.search__pre, .search__input {
    color: white;
    background-color: black;
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.63);
}

.search__pre {
    width: 20%;
    border-radius: 5.5px 0 0 5.5px;
    margin-right: 0px;

    display: flex;
    align-items: center;
    justify-content: center;

    &-image {
        width: 35px;
        @include breakpoint(mobile) {
            width: 17px;
        }
    }

    &::before {
        width: 1px;
        height: 75%;
        background-color: white;
    }
}

.search__input {
    font-family: $font-body;
    font-size: $font-lg;
    @include breakpoint(mobile) {
        font-size: $font-base;
    }

    border: 0;
    border-radius: 0 5.5px 5.5px 0;

    width: 100%;
    margin-left: 0px;

    &:focus {
        outline: none;
    }

    &::placeholder, &:placeholder-shown {
        color: rgba(255, 255, 255, 0.26);
        font-style: italic;
    }
}
</style>
