"use client";

import { ICard } from "@/lib/api";
import { CARD_SHOW_PATH } from "@/lib/paths";
import { supabase } from "@/lib/supabase/supabaseClient";
import { getThumbnail, getYouTubeEmbedUrl, isYouTubeURL } from "@/lib/utils";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import moment from "moment";
import Link from "next/link";
import { useEffect, useState } from "react";
import CardActions from "../Card/CardActions";
import styles from "./homeresults.module.scss";

const MAX_CHARACTERS_PREVIEW = 20000;

const LOADING_MESSAGES = [
  "Processing your request...",
  "About 30 seconds remaining...",
  "Processing your request...",
  "About 25 seconds remaining...",
  "About 25 seconds remaining...",
  "Processing your request...",
  "About 20 seconds remaining...",
  "About 20 seconds remaining...",
  "Processing your request...",
  "Processing your request...",
  "About 15 seconds remaining...",
  "About 15 seconds remaining...",
  "Processing your request...",
  "About 10 seconds remaining...",
  "About 10 seconds remaining...",
  "Hang tight...",
  "Hang tight...",
  "Hang tight...",
  "About 5 seconds remaining...",
  "About 5 seconds remaining...",
  "Finishing up...",
];

const WAIT_MS = 2500;

export default function QueryResult({ card }: { card: ICard }) {
  const { created_at: createdAt, citations } = card;
  const [msgIndex, setMsgIndex] = useState<number>(0);
  const initialLoadingState = !card.responses || card.responses.length === 0;
  const [isLoading, setIsLoading] = useState<boolean>(initialLoadingState);
  
  const [responses, setResponses] = useState<{ response: string }[]>([]);

  const [prettyCreatedAt, setPrettyCreatedAt] = useState(
    !!createdAt && new Date(createdAt) < new Date()
      ? moment(createdAt).fromNow()
      : moment().fromNow()
  );
  const thumbnail = getThumbnail(citations || []);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (isLoading) {
      intervalId = setInterval(() => {
        setMsgIndex((prevIndex) => (prevIndex + 1) % LOADING_MESSAGES.length);
      }, WAIT_MS);
    }

    const channel = (supabase.channel(`cards:id=eq.${card.id}`) as any)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public" },
      (payload: { new: { id: string; responses: { response: string }[] } }) => {
        console.log("Payload received:", payload);
        if (payload.new.id === card.id) {
          const newResponses = payload.new.responses || [];
          console.log("New Responses:", newResponses);

          setResponses(newResponses);

          if (newResponses.length > 0) {
            setIsLoading(false);
            if (intervalId) {
              clearInterval(intervalId);
            }
          }
        }
      }
    )
    .subscribe();

    return () => {
      channel.unsubscribe();
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [card.id, isLoading]);

  const CardBody = () => {
    const displayText = responses
      .map((responseObj) => responseObj.response)
      .join(" ")
      .substring(0, MAX_CHARACTERS_PREVIEW);
    return (
      <Link href={`${CARD_SHOW_PATH}/${card.id}`}>
        <div>
          <h4 className="text-xl font-bold">{card.title}</h4>
          <h6 className="text-xs">
            <span className="text-purple">
              {card.is_mine ? "You | " : null}
            </span>
            <span className="text-black">{prettyCreatedAt}</span>
          </h6>

          {!isLoading ? (
            <p className="my-5">
              {displayText}
              {displayText.length > MAX_CHARACTERS_PREVIEW ? "..." : null}
            </p>
          ) : (
            <p className="my-5">
              <FontAwesomeIcon
                icon={faSpinner}
                className="mx-2 h-5 w-5 animate-spin align-middle duration-300"
              />
              {LOADING_MESSAGES[msgIndex]}
            </p>
          )}

          {isYouTubeURL(thumbnail?.source_url) && (
            <iframe
              id="ytplayer"
              src={getYouTubeEmbedUrl(thumbnail?.source_url)}
              frameBorder="0"
              className="h-64 w-full lg:h-96"
            ></iframe>
          )}
        </div>
      </Link>
    );
  };

  return (
    <div id={isLoading ? "loading" : "loaded"} className={styles["card"]}>
      <div
        className={`my-6 space-y-4 rounded-lg bg-blue p-6 text-primary ${
          isLoading ? "border-4 border-dashed border-yellow-500" : ""
        }`}
      >
        <CardBody />
        <CardActions card={card} />
      </div>
    </div>
  );
}
